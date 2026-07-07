# Salah API

## APNs readiness

Production Live Activity pushes require:

- `SALAH_APNS_KEY_ID`
- `SALAH_APNS_TEAM_ID`
- `SALAH_APNS_BUNDLE_ID`
- `SALAH_APNS_AUTH_KEY` or `SALAH_APNS_AUTH_KEY_PATH`

Build the API, then run the readiness check with the production environment:

```sh
npm run api:build
sudo bash -c 'set -a; . /etc/salah-api.env; set +a; cd /home/abdlh/repos/salah; node dist-api/apnsSmoke.js'
```

To send one real push-to-start smoke test to a physical iPhone, also provide
`SALAH_APNS_TEST_TOKEN` and, if needed, `SALAH_APNS_TEST_ENVIRONMENT`.
