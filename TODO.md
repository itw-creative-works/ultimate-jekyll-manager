- easy system for a main css, js, etc bundle BUT user can make page specific bundles
- uncompiled should move everything inside it to css/images/js/vendor
- make an update fn that will update UJ eith er in `npx uj setup` or a separate process

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



MAYBE
 # - name: Log all files in node_modules/ultimate-jekyll-manager
      #   run: |
      #     echo "All files in node_modules/ultimate-jekyll-manager: "
      #     ls -R node_modules/ultimate-jekyll-manager
      # - name: Fetch ensure-production-build.js
      #   run: |
      #     [ -d node_modules/ultimate-jekyll-manager ] || mkdir -p node_modules/ultimate-jekyll-manager
      #     curl -L https://raw.githubusercontent.com/itw-creative-works/ultimate-jekyll-manager/refs/heads/master/src/ensure-production-build.js > node_modules/ultimate-jekyll-manager/ensure-production-build.js
      # - name: Log all files in repo
      #   run: |
      #     echo "All files in the repo: "
      #     ls -R *
      # - name: Run node build
      #   # run: npm run build -- --buildLocation='server'
      #   run: |
      #     UJ_BUILD_MODE=true UJ_IS_SERVER=true node node_modules/ultimate-jekyll-manager/ensure-production-build.js && npx uj setup && npm run build
      # - name: Create build.json
      #   run: |
      #     export TZ=UTC date
      #     timestamp=$(date +%FT%TZ)
      #     temp_build_json=$(cat @output/build/build.json)

      #     echo account: $GITHUB_ACTOR
      #     echo repo: $GITHUB_REPOSITORY
      #     echo timestamp: $timestamp
      #     echo build.json: $temp_build_json

      #     build_log_path="@output/build/build.json"
      #     sed "s/%GHP_TIMESTAMP%/$timestamp/g" $build_log_path > "$build_log_path"-temp && mv "$build_log_path"-temp $build_log_path

      #     sed -n '1h;1!H;${;g;s/GEN>>>.*<<<GEN/<REDACTED FOR LIVE PUBLISH>/g;p;}' .gitignore > .gitignore
      # - name: Delete gh-pages branch
      #   uses: dawidd6/action-delete-branch@v3
      #   with:
      #     github_token: ${{ secrets.GH_TOKEN }}
      #     branches: gh-pages
      #     soft_fail: true

      # - name: Purge artifacts
      #   uses: c-hive/gha-remove-artifacts@v1
      #   with:
      #     ages: '5 minutes' # '<number> <unit>', e.g. 5 days, 2 years, 90 seconds, parsed by Moment.js
      #     # Optional inputs
      #     # skip-tags: true
      #     # skip-recent: 5
      # - name: Purge artifacts
      #   uses: geekyeggo/delete-artifact@v5
      #   with:
      #       name: github-pages

    "deploy": "UJ_BUILD_MODE=true UJ_IS_SERVER=true npx uj setup && npm run build"
