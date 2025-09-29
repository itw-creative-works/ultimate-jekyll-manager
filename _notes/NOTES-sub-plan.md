ok so i need help planning the storage, trial eligibility, and webhooks. im not exactly sure WHAT to store and WHEN to store it. But heres what i know so far

* This system we are building is a centralized checkout system for multiple apps that offer multiple products
  * This is why we store and keep track of the "app" and "product id" in the database and http calls.

* Prevent users who HAVE A SUBSCRIPTION from buying another one
  * We will need to check our database to see if the user has an active subscription, as in one that is not cancelled.
  * If the user has an active subscription, they should NOT be able to buy another one.

* We need to keep track of which users have had a trial already.
  * There is TRIAL OFFERING and TRIAL ELIGIBILITY. TRIAL OFFERING means a product offers the possibility of a trial (stored in the app.products.[product-id].trial as either 0 or a number of days), and TRIAL ELIGIBILITY means the user is eligible for a trial, which is TRUE if the user has never used a trial for THAT PRODUCT in THAT APP .
  * For this we need to store the "app", the "product.id", the "auth.uid", and the "geolocation.ip". In other words, for every product in a given app, we cant let a person use the trial more than once. So we should search for a product id of an app and if EITHER the UID or the IP address is found, then we should not allow the user to use the trial. A user can take a trial for a DIFFERNT product in the same app, or a different app entirely. Its only for the same product in the same app that we should not allow a trial more than once.
  * This is because we dont want people to abuse the trial system.
  * If the product DOES NOT OFFER A TRIAL, then we should not even check for a trial and assume they are not eligible for one.

* I want to implement a custom "abandoned cart" system
  * The moment a user lands on the checkout page, we will store the cart somewhere in our database by sending an HTTP request to our server with the cart data.
  * This way, we can loop through every day and if the user has not completed their checkout, we can send them an email reminding them to complete their purchase, one at 1 day, 3 days, and 7 days after they first landed on the checkout page. The link to go back will have their unique checkout ID in the URL.
  * When they go to the checkout and send the request to our server, we will check if there is a cart with that ID, and if so, we will reset that cart's timer so we can send more abandoned cart emails if they still do not complete their purchase.
  * Essentially, every time they visit checkout we will check if they have an abandoned cart, and if so, we will reset the timer for that cart.

* We need to set up webhook listener for stripe, paypal, etc
  * Update the database with subscription events like when it becomes active, cancelled, etc.
  * When we receive an event for say, subscription cancelled, we will need to find the record and update the status
  * Without getting too ahead of ourselves, I would like to DESIGN A PROPRIETARY and UNIFIED object that we can use to store the subscription data and status. This way, no matter what payment provider we use, we can ensure the user has access to their paid features etc without having to consider all the different payment providers own data structures. In this sense, we will create a "resolved" subscription object that contains data regarding when the subscription started, whether it is active/cancelled/suspended (meaning unpaid), the payment provider, the product id, the app id, and any other relevant data we need to store. This way, we can use this object to check if a user has an active subscription or not, regardless of the payment provider.
  * Also without getting too ahead of ourselves, we will need to send our own HTTP requests to the individual APP that is usinng our unified checkout system. So essentialy we will send a request with the subscription data AND THE RESOLVED SUBSCRIPTION OBJECT to the app that is using our checkout system. This way, the app can update its own database with the subscription data and status, and we can ensure that the user has access to their paid features in THAT SPECIFIC APP.

SO... ALL OF THE ABOVE CONSIDERED... Where should all of these checks happen and where should we store the data? By that I mean, which server functions do we perform these checks and what collections in firestore do we need?
  * Do we store the entire lifecycle of an order in one collection? Or do we store parts of it in different collections?
  * Storing in ONE COLLECTION
    * we would store all the trial related data, the app, product, user, and geolocation data in one collection
    * We would have a status field that indicates at what stage the order is in such as if its just a payment intent or if it was completed
  * Storing in multiple collections
    * We would only store what we need for the specific operation, like we could habe a "payment-trials" collection that keeps track of app, product, user, and IP address, and a "payment-orders" collection that keeps track of the order status, payment provider, etc. and then a "payment-subscriptions" collection that keeps track of the subscription status, start date, end date, etc.

SO... What is the best way to store this data and what endpoints should we set up?
