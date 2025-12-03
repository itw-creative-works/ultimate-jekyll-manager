
NEW TODO
- service working failing to load scripts??
- test SW on live site (and lighthouse)
- LOGIN NOT WORKING: email and password says its wrong, google just takes you back to the signin page and nothing happens
- FIx formmanager .getData() it keeps returning an empty object, make it work flawlessyly
- It keeps testing whether there is a "." every time it reads or writes. just call the getNested and setNested functions and then check for the DOT inside those functions
- form manager should NOT submit if the button that was clicked is disabled (class or attribute)
- script that adds some helpful classes to the body or attributes to html maybe like
  * data-device="mobile|tablet|desktop"
  * data-browser="chrome|safari|firefox|edge|opera|other"
  * data-os="windows|macos|linux|android|ios|other"

Make an admin dashboard backend

Admin dashboard backend pages
* View and search users
* Read and write to firestore
  * I should be able to put in a path and get the whole JSON object into a nice code textarea editor
  * Then i can make changes and save it back
* Plan creator page
  * Can put in monthly and annual price and ID etc
  * It iwll creat the product in firestore
  * Create the product in stripe, paypal, etc


ok now were working on THIS PAGE to ensure standardization accross all pages in terms of section layout, language, and structure. first, do our main checks like
* ensuring the frontmatter sections appear in the same order as in the html
* that there are no named items that could be arrays, etc
* all sections in HTML have a frontmatter section that controls the content
* all sections are standardized like have a heading, subheading, items, etc. dont add these if they dont make sense, but ensure that if there is HTML content hardcoded that it is converted to frontmatter content
* ONLY HERO section should have an accent gradient in the heading, other ssections should NOT have this. However, other sections can have text-accent which is the cursive/brutalism accent. FOr this, only the LAST WORD should be accented and if the last word is the BRAND, it sholuld be reworded so the last word is NOT the brand name
* main sections and CTA's should have a superheadline, headline, and subheadline. if any of these are missing, add them to the frontmatter and make the HTML conditional so it only appears if there is content for it
* superheading should be ONE WORD if possible and should have an icon
* superheading should NOT be all caps, regular case

MAKE COMPONENTS? ASK CLAUDE HOW AND IF ITS POSSIBLE

FIX SIGNIN/SINGUP FORM

https://192.168.86.69:4000/payment/checkout?product=premium&_dev_trialEligible=true&_dev_appId=dev&_dev_cardProcessor=stripe

filter-adaptive-inverse

CLAUDE FOR CONSUMIN PROJECT OLD VERSION
# Identity
This is a jekyll site that is "consuming" a jekyll template project called Ultimate Jekyll--a collection of components that can be used to build a Jekyll site quickly and efficiently.

## UJ Documentation
You should have a full understanding of Ultimate Jekyll before editing this project, which can be found at: node_modules/ultimate-jekyll-manager/CLAUDE.md

## Notes
Ultimate Jekyll expects this project to be in the following structure:
/src = Editable files that are compiled to /dist by Ultimate Jekyll
/dist = Compiled files that are copied to _site by Ultimate Jekyll (DO NOT EDIT THESE FILES)
/_site = Compiled files that are served by Jekyll (DO NOT EDIT THESE FILES)

Other files you should NOT edit:
Gemfile = This is managed by Ultimate Jekyll and should not be edited by the user.

Other important folders:
src/pages = This is where we create pages
src/redirects = This is where we create redirects

CSS and JS files:
src/assets/css/pages = This is where we create page-specific stylesheets (src/assets/css/pages/terms/index.scss will load with site.com/terms)
src/assets/js/pages = This is where we create page-specific JavaScript files (src/assets/js/pages/terms/index.js will load with site.com/terms)
src/assets/css/pages/index.scss = Stylesheet for the homepage (site.com/)
src/assets/js/pages/index.js = JavaScript for the homepage (site.com/)

src/assets/css/main.scss = Main stylesheet for the site (all pages will load this file)
src/assets/js/main.js = Main JavaScript file for the site (all pages will load this file)



REVIEW page
- Make a rewarded review page. When the user lands there, it explains that they COULD win $25 Amazon giftcard for writing a reivew. They upload the screenshot then it sends them to a fake countdown page where 3 winners are picked every week. So it conts down and tells them to refresht he page. At the end of the week it picks 3 random winners but it should never axtually pick anyone and just tell them to try again next week. But it should look legit.


MIGRATIONS

TEST:
<br>
site.uj.cache_breaker={{ site.uj.cache_breaker }}
<br>
page.random_id={{ page.random_id }}
<br>


REMOVE
settings.include-socialsharekit
settings.blog-post-image-class
settings.blog-author-image-class

admin-dashboard:

REMAKE main/misc/embed-manager.html in UJ
REMAKE the dashboard one in UJ
FINISH redirec.js in UJ

# Fix notifications
* UJ 2.0 for a while was making a DUPLICATE notifaction in users/{uid}/notifications/{token} AND in notifications/{token}
* We can SAFELY DELETE the users/{uid}/notifications collection
* EX: https://console.firebase.google.com/project/replyify-app/firestore/databases/-default-/data/~2Fnotifications~2Fsubscriptions~2Fall
* Also, there are residual notifications/subscriptions/all/{token} that need to be MIGRATED to the new format
* EX: https://console.firebase.google.com/project/replyify-app/firestore/databases/-default-/data/~2Fnotifications~2Fsubscriptions~2Fall~2FczUMa9wW0n3FnjpKCL5Wet:APA91bFD9YpwBqtn0i6qVabxiNl1uqIl3Ka1ObNM9CWT5NjzjnlTnyCA7e0G3Y3GGzIEcJUPoDLnGBRP3xBob99EiWItKtOuWP3Sqb906zBYJGFENIyQOJIUw43tizN5lCSq6ICgVJsZ

# BEM API
* Many places still use "payload.data.authenticationToken", we need to migrate to the "Bearer *" format (since WM sends that now)
* Honestly, the whole API auth system needs to be rethought and redone: /Users/ian/Developer/Repositories/ITW-Creative-Works/backend-manager/src/manager/functions/core/actions/api
  * Write tests and then refactor the whole thing
* Had an idea to make backend-manager tetss for lots of stuff? where were the notes for that?

FIX THE settings like
* layout.settings.manager-configuration
THey are super disorganized and not consistent and some are not needed anymore
* Maybe make each setting  a key in settings, like
settings:
  manager-configuration:
    firebase: "
      {}
    "
That way, we can take advantage of the page.resolved to OVERRRIDE EVYERHING!


QUESTIONS
- how do we import theme CSS and JS into the bundles?
- how do we handle bundles for frontend and backend?
- how do we handle bundles for different themes?

- easy system for a main css, js, etc bundle BUT user can make page specific bundles
- uncompiled should move everything inside it to css/images/js/vendor
- make an update fn that will update UJ eith er in `npx uj setup` or a separate process

- we shoudl be able to MERGE site settings
  - so site is default, then merge layount, then merge page (each OVERWRITING the previous one)

TEMPORARY THAT WE NEED TO REMOVE
src/assets/js/pages/terms/helper.js
src/assets/js/pages/terms/index.js
src/assets/js/pages/index.js
src/assets/css/pages/index.scss
src/assets/css/pages/terms/index.scss

MIGRATIONS
- @output/build/build.json --> build.json
  - there are some references inside that changed too:
    - npm-build --> timestamp
    - brand --> config.brand
    - admin-dashboard --> config.admin-dashboard
- modules/adunits/adsense/adsense-display --> modules/adunits/adsense
  - and then type="display"
  - Same goes for every adsense type
    - adsense-in-article
    - adsense-in-feed
    - adsense-multiplex
post:
  description: ---> description: (IN THE ACTUAL POSTS)

site.time | date: '%s'  --> site.uj.cache_breaker

uj-website-json -- uj-schema-website

facebook-pixel --> meta-pixel

/@output/build/build.json --> /build.json
// Legacy
// TODO: REMOVE
// 'npm-build': new Date().toISOString(),
// brand: config.brand,
// 'admin-dashboard': JSON5.parse(config['admin-dashboard']),

Manager.properties.global, and other Manager.properties (IN UJ TOO!)

Notification firestore structure/schema has changed a bit

user:sign-up fetch request has new structure including context

---------





THINGS TO ADD
- auto cached translations
  - sitemap for each translation?
  - need to add HTML tags for each equivalent translation (not all pages have translations!!!!)
- each theme should have complex COMPONENTS to easily scaffold large parts of the site
  - keep components consistent across themes so when we switch themes the components work still
- checkout pages SHOULD BE IN EACH WEBSITE
  - this way, pixel events can be sent from the actual domain
  -

// Legacy
// TODO: REMOVE REFERENCES TO
'npm-build': new Date().toISOString(),
brand: config.brand,
'admin-dashboard': JSON5.parse(config['admin-dashboard']),

when user is required to login (auth.required=true from UJ), pass back a query that is loginRequired=true (or something similar) so that the user can be displayed a message to login. or we can just use the fact that there is a redirect query already

automatic subprocessor list
- https://sentry.io/legal/subprocessors/

Terms of service
- https://zapier.com/legal/terms-of-service
- https://sentry.io/terms/
- https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#the-github-terms-of-service
- https://help.instagram.com/termsofuse
- https://discord.com/terms
- Update arbitration: https://www.equifax.com/terms/

prechat-btn
- should have width and height set to 0px INLINE so it doesnt appear HUGE when loading
- then automatically remove the style attribute after the button is loaded

https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/fetchPriority
- there is also one for images
- fetchpriority="high" for critical scripts and images

CONTACT
<div style="display: none;">
  <input type="email" name="slap_honey" class="form-control" placeholder="Your Email">
</div>

# Translation
translation:
  enabled: false
  default: "en"
  languages:
    - "en"  # English
    - "zh"  # Chinese (Simplified)
    - "es"  # Spanish
    - "hi"  # Hindi
    - "ar"  # Arabic
    - "pt"  # Portuguese
    - "ru"  # Russian
    - "ja"  # Japanese
    - "de"  # German
    - "fr"  # French
    - "ko"  # Korean
    - "ur"  # Urdu
    - "id"  # Indonesian
    - "bn"  # Bengali
    - "tl"  # Tagalog
    - "vi"  # Vietnamese
    - "it"  # Italian


PRICING PRODUCT
<!-- Product -->
<script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "{{ page.gift.title }}",
    "url": "{{ site.url }}{{ page.url }}",
    "image": "{{ page.gift.images | first }}",
    "description": "{{ page.gift.description }}",
    "sku": "{{ page.gift.id }}",
    "brand": {
      "@type": "Brand",
      "name": "{{ page.gift.brand }}"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "{{ page.gift.rating_score }}",
      "reviewCount": "{{ page.gift.rating_count }}"
    },
    "offers": {
      "@type": "Offer",
      "url": "{{ site.url }}{{ page.url }}",
      "priceCurrency": "USD",
      "price": "{{ page.gift.price }}",
      "priceValidUntil": "{{ site.time | date: '%s' | plus: 2592000 | date: '%Y-%m-%d' }}",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "{{ page.gift.brand }}"
      }
    }
  }
</script>


<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "url": "{{ site.url }}{{ page.url }}",
    "name": "Free AI {{ page.subject-parameters.title }} Homework Helper",
    "description": "A 24/7 free {{ page.subject-parameters.title }} homework AI tutor that instantly provides personalized step-by-step guidance, explanations, and examples for any {{ page.subject-parameters.title }} homework problem. Improve your grades with our AI homework helper!",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web-based",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "provider": {
      "@type": "Organization",
      "name": "{{ site.brand.name }}",
      "url": "{{ site.url }}"
    },
    "featureList": [
      "AI-powered step-by-step solutions",
      "Free AI Homework Help",
      "Subject-specific assistance",
      "Instant answers",
      "24/7 availability",
      "User-friendly interface"
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "699422"
    },
    "review": {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5"
      },
      "author": {
        "@type": "Person",
        "name": "Nora B"
      },
      "reviewBody": "{{ site.brand.name }} has been an absolute lifesaver for my homework! The AI tutor provides clear, step-by-step explanations that have helped me understand complex concepts. I love how I can get help anytime, day or night!"
    }
  }
</script>


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


tempalte names

- clear
- glass
- classy
- glassy
- flassy
- modern
-
