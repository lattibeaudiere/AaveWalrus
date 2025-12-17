.PHONY: help migrate test

help:
	@echo "Available targets:"
	@echo "  migrate   - Apply SQL migrations in storage/migrations"
	@echo "  test      - Run pytest"

migrate:
	@echo "Applying DB migrations..."
	python3 storage/apply_migrations.py

test:
	python3 -m pytest -q
