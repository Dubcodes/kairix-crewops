from app.config import Settings


def test_cors_origins_accepts_comma_separated_values():
    settings = Settings(
        environment="development",
        secret_key="dev-change-me",
        cors_origins="http://localhost:8088,https://crewops.example.org",
    )

    assert settings.cors_origin_list == ["http://localhost:8088", "https://crewops.example.org"]


def test_cors_origins_accepts_json_list_values():
    settings = Settings(
        environment="development",
        secret_key="dev-change-me",
        cors_origins='["http://localhost:8088", "https://crewops.example.org"]',
    )

    assert settings.cors_origin_list == ["http://localhost:8088", "https://crewops.example.org"]
