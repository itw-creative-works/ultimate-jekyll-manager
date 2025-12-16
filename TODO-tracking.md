TODO
* Does signup work with BEM 5.0?? keeps ssying cannot resolve user after i sign up and try to go into accout :(


  FIX ATTRIBUTION
  https://claude.ai/share/bae8e516-e74c-4e77-9a85-e58277908b43

i want to also add my own "itm" tags which are set by internal things. can we process those too?

// attribution.js - load this on every page
(function() {
  const params = new URLSearchParams(window.location.search);

  // Check if this pageview has any attribution params
  const hasAttribution = params.get('fbclid') || params.get('gclid') ||
                         params.get('ttclid') || params.get('utm_source');

  if (hasAttribution) {
    const attribution = {
      fbclid: params.get('fbclid'),
      fbc: getCookie('_fbc'),
      gclid: params.get('gclid'),
      ttclid: params.get('ttclid'),
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
      landingPage: window.location.pathname,
      capturedAt: new Date().toISOString(),
    };

    // Only save if we don't already have attribution (first-touch)
    if (!localStorage.getItem('attribution')) {
      localStorage.setItem('attribution', JSON.stringify(attribution));
    }
  }
})();


TODO
fix tiktok pixel events (look at this)

Test deletion account flow


PROBLEM
navigatin to https://192.168.86.69:4000/reset?authSignout=true

WHILE SIGNED IT signs you out (GOOD) but then it KICKS you back to INDEX (BAD) istead of STAYING O THE PAGE

FIX FORM MANAGER

FIX TIKTKO PIXELS TRACKING ID NOT CORRECT

   output: {
     filename: '[name].[contenthash].js',
     sourceMapFilename: '[name].[contenthash].js.map',
   },
   devtool: Manager.isProd() ? 'hidden-source-map' : 'eval-source-map',


signout on homepage
* sign up / singin button does NOT reappear (there is just no button)


try not to expose Manager??


