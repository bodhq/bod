"""Development deployments must not weaken or overwrite school installations."""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "deploy"))
import development


class Development(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.images = {
            f"{service.upper()}_IMAGE": f"ghcr.io/bodhq/bod/{service}@sha256:"
            + "a" * 64
            for service in ("api", "web")
        }

    def response(self, payload):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = payload
        return patch.object(development, "urlopen", return_value=response)

    def test_only_complete_correctly_paired_digests_are_accepted(self):
        payload = "".join(
            f"{key}={value}\n" for key, value in self.images.items()
        ).encode()
        with self.response(payload):
            self.assertEqual(development.fetch_images(), self.images)
        for bad in (
            b"API_IMAGE=latest\nWEB_IMAGE=latest\n",
            payload.replace(b"/api@", b"/web@"),
            payload + b"POSTGRES_PASSWORD=injected\n",
            payload + b"x" * 4097,
        ):
            with self.response(bad), self.assertRaises(ValueError):
                development.fetch_images()

    def test_http_is_explicitly_development_only_and_secure_https_remains_available(
        self,
    ):
        development.configure(self.root, "http://10.202.30.201:8080")
        config = development.read_env(self.root / "config.env")
        self.assertEqual(config["COOKIE_SECURE"], "false")
        self.assertEqual(config["BOD_HTTP_PORT"], "8080")
        self.assertEqual(config["ALLOWED_ORIGINS"], '["http://10.202.30.201:8080"]')
        self.assertEqual((self.root / "config.env").stat().st_mode & 0o777, 0o600)
        with self.assertRaises(ValueError):
            development.configure(self.root, "https://dev.bodhq.cz")
        (self.root / "config.env").unlink()
        development.configure(self.root, "https://dev.bodhq.cz")
        self.assertEqual(
            development.read_env(self.root / "config.env")["COOKIE_SECURE"], "true"
        )

    def test_school_installation_is_never_modified(self):
        development.write_env(self.root / "config.env", {"BOD_PROJECT": "bod-school"})
        with (
            patch.object(development, "fetch_images") as fetch,
            self.assertRaises(ValueError),
        ):
            development.update(self.root)
        fetch.assert_not_called()

    def test_bad_manifest_never_reaches_docker(self):
        development.configure(self.root, "http://10.202.30.201:8080")
        with (
            patch.object(development, "fetch_images", side_effect=ValueError("bad")),
            patch.object(development.School, "compose") as compose,
            self.assertRaises(ValueError),
        ):
            development.update(self.root)
        compose.assert_not_called()

    def test_already_applied_pair_does_not_restart_services(self):
        development.configure(self.root, "http://10.202.30.201:8080")
        for name in ("images.env", ".development-applied.env"):
            development.write_env(self.root / name, self.images)
        with (
            patch.object(development, "fetch_images", return_value=self.images),
            patch.object(development.School, "compose") as compose,
        ):
            development.update(self.root)
        compose.assert_not_called()

    def test_unhealthy_initial_installation_does_not_bootstrap_or_claim_success(self):
        development.configure(self.root, "http://10.202.30.201:8080")
        with (
            patch.object(development, "fetch_images", return_value=self.images),
            patch.object(development.School, "require_space"),
            patch.object(
                development.School, "compose", side_effect=ValueError("unhealthy")
            ),
            self.assertRaises(ValueError),
        ):
            development.update(self.root)
        for name in (".initialized", ".development-applied.env", ".first-admin.txt"):
            self.assertFalse((self.root / name).exists())

    def test_failed_update_does_not_claim_success_and_remains_retryable(self):
        development.configure(self.root, "http://10.202.30.201:8080")
        development.write_env(
            self.root / "images.env", {"API_IMAGE": "old", "WEB_IMAGE": "old"}
        )
        (self.root / ".initialized").touch()
        with (
            patch.object(development, "fetch_images", return_value=self.images),
            patch.object(development.School, "require_space"),
            patch.object(
                development.School, "update", side_effect=ValueError("failed")
            ),
            self.assertRaises(ValueError),
        ):
            development.update(self.root)
        self.assertFalse((self.root / ".development-applied.env").exists())


if __name__ == "__main__":
    unittest.main()
