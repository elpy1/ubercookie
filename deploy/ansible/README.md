# Ansible deployment

This playbook deploys ubercookie to a server behind Cloudflare:

- FastAPI runs locally on `127.0.0.1:8000` as the `ubercookie` system user.
- nginx terminates HTTPS and proxies the app.
- nginx treats `ubercookie.xyz` as canonical and 301-redirects `www.ubercookie.xyz` to the apex.
- Certbot uses DNS-01 through Cloudflare with `certbot-dns-cloudflare==4.2.0`.
- firewalld and nginx both restrict HTTP/HTTPS ingress to Cloudflare IP ranges.
- nginx sets conservative cache headers: hashed Vite assets are immutable, HTML and `sw.js` revalidate, and API cache-vector responses are left to the backend.

## Secrets

Either export them before running:

```bash
export CF_API_TOKEN=...
export LETSENCRYPT_EMAIL=admin@example.com
```

or copy `inventory/group_vars/all/vault.yml.example` to `inventory/group_vars/all/vault.yml` and encrypt it:

```bash
ansible-vault encrypt inventory/group_vars/all/vault.yml
```

The Cloudflare token only needs permission to edit DNS for `ubercookie.xyz`.

## Deploy

Run from this directory:

```bash
ansible-playbook playbooks/site.yml
```

If `inventory/group_vars/all/vault.yml` is encrypted, run:

```bash
ansible-playbook playbooks/site.yml --ask-vault-pass
```

Ansible handles the initial certificate request; you do not need to create the certificate manually first. The certbot role installs `/usr/local/sbin/ubercookie-certbot-renew`, runs it once during deployment, and enables a twice-daily `ubercookie-certbot-renew.timer`. The script uses Cloudflare DNS-01 and reloads nginx through certbot's deploy hook only when a certificate is actually issued or renewed.

To run a staging dry-run before the real certificate request, add:

```bash
ansible-playbook playbooks/site.yml -e certbot_test_before_issue=true
```

By default the certificate covers the nginx server names, `ubercookie.xyz` and `www.ubercookie.xyz`. To override:

```yaml
ubercookie_certificate_domains:
  - ubercookie.xyz
  - "*.ubercookie.xyz"
```

## Notes

Cloudflare IPv4 ranges are fetched on each run and rendered into nginx plus a firewalld ipset. IPv6 is disabled by default; set `ubercookie_cloudflare_ipv6_enabled: true` if the origin needs.

The vhost config is at `/etc/nginx/sites-available/ubercookie.xyz.conf` and enabled through `/etc/nginx/sites-enabled/`.

HSTS is disabled for now (`nginx_hsts_max_age: 0`) so it does not accidentally become part of the demo before the HSTS supercookie idea is designed deliberately.
