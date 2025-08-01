Build a checkout page @ src/defaults/dist/_layouts/themes/bootstrap/frontend/pages/purchase/checkout.html
CSS: src/assets/css/pages/purchase/checkout/index.scss
JS: src/assets/js/pages/purchase/checkout/index.js
If you need inspiration for how to build a page, look at src/defaults/dist/_layouts/themes/bootstrap/frontend/pages directory.
* Use bootstrap 5.3.1

The checkout page should include:
* cards and sections for each step of the checkout process
* a summary of the items being purchased
* a place for a discount code (if user enters a correct code, apply discount)
* Support multiple payment methods (credit card, PayPal, Cypto.)

* We should be able to get a JSON object and dynamically alter the page contents, like adding some form fields
* when the user lands on the page, a query parameter with the product id is there to help us load the product details.
* use the product ID along with the {{ site.brand.app}} id to make a fetch request to https://api.itwcreativeworks.com/app/{app id} to get the product details, price, etc, (its in the response.products[product_id] key), use test data for now. but add the fetch request and jsut assume we use the test data no matter what.
* the product data will also include whether it is a subscription or one-time purchase.
* if its a subcripiton were gonna display some slighly different UI,
  * like a toggle for monthly or yearly billing (and show the prices ad how much they are saving by using the yearly billing option)
  * a message that either says "YOu are eligible for a free trial" or "You are not eligible for a free trial" based on the product data in green or red ralert espectively.
  * A message like "You will be charged $X {monthky/annually} starting on {date}" if they have a free trial, or "You will be charged $X today and {annually\monthly} starting {date}" if they do not have a free trial.

* IN JS, we should calculate the price after the discount code is applied, and update the total price dynamically, consider also whether they are elgiible for a free trial.

* A banner that is fixed to the top of the page that says "FLash sale! Use code FLASH20 for 20% off your purchase!".

Next, build a quick /purchase/confirmation.html,
* The confirmation page should show a summary of the purchase and a thank you message.





and a /purchase/cart.html that just redirects to the checkout page for now and is meant for sending analytics events and ensuring the user is signed in.
