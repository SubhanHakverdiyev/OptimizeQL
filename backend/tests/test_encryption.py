"""Tests for Fernet encryption/decryption utilities."""

import pytest

from core.encryption import decrypt, encrypt


class TestEncryption:
    def test_round_trip(self):
        plaintext = "my-secret-password"
        token = encrypt(plaintext)
        assert decrypt(token) == plaintext

    def test_different_plaintexts_produce_different_tokens(self):
        t1 = encrypt("password1")
        t2 = encrypt("password2")
        assert t1 != t2

    def test_decrypt_invalid_token_raises_value_error(self):
        with pytest.raises(ValueError, match="Invalid or corrupted"):
            decrypt("not-a-valid-fernet-token")

    def test_encrypt_empty_string(self):
        token = encrypt("")
        assert decrypt(token) == ""

    def test_unicode_round_trip(self):
        plaintext = "p@sswörd-日本語-🔑"
        token = encrypt(plaintext)
        assert decrypt(token) == plaintext

    def test_long_string_round_trip(self):
        plaintext = "x" * 10_000
        token = encrypt(plaintext)
        assert decrypt(token) == plaintext
