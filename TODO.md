- easy system for a main css, js, etc bundle BUT user can make page specific bundles
- uncompiled should move everything inside it to css/images/js/vendor


MIGRATIONS
- @output/build/build.json --> build.json
  - there are some references inside that changed too:
    - npm-build --> timestamp
    - brand --> config.brand
    - admin-dashboard --> config.admin-dashboard

// Legacy
// TODO: REMOVE REFERENCES TO
'npm-build': new Date().toISOString(),
brand: config.brand,
'admin-dashboard': JSON5.parse(config['admin-dashboard']),
