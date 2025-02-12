---
### ALL PAGES ###
layout: themes/geeks/frontend/plain
sitemap:
  include: true

### REGULAR PAGES ###
meta:
  title: "Privacy Policy"
  description: "This privacy policy has been compiled to better serve those who are concerned with how their personal information is being used online."
  breadcrumb: "Privacy Policy"

settings:
  manager-configuration: "
    {
      exitPopup: {
        enabled: false,
      },
    }
  "
---

{% capture brand %}**{{ site.brand.name | liquify }}**{% endcapture %}
{% capture breadcrumb %}{{ page.meta.breadcrumb | default: layout.meta.breadcrumb | liquify }}{% endcapture %}

### Effective date: <span class="text-primary">8th of April, 2017</span>
<hr>

Welcome to [{{ site.url }}]({{ site.url }}). This website is owned and operated by {{ brand }} ("{{ brand }}", "we", "us", or "our"). By visiting our website ("the website", "the site", "our website", or "our site"), using the {{ brand }} application ("the software", "the application", "our software", "our application", "our app", or "the app"), and/or accessing the information, resources, services, and tools we provide, you acknowledge, understand, and agree to accept and adhere to the following {{ breadcrumb }} as stated in this policy. Our Policy applies to all visitors, users, and others who access the Service ("Users").

This {{ breadcrumb }} describes how {{ brand }} and our affiliated entities collect, use, process, and share your personally identifiable information. Our {{ breadcrumb }} is designed to provide transparency into our privacy practices and principles, in a format that our users can easily navigate, read, and understand.

We are dedicated to treating your personal information with care and respect. If there is anything that is not clear from this {{ breadcrumb }}, please feel free to contact our support team: [{{ site.url }}/contact]({{ site.url }}/contact).

Please note that this {{ breadcrumb }} applies to {{ brand }} and its Services. When using {{ brand }}, you may find links to other websites, apps, and services, or tools that enable you to share information with other websites, apps, and services. {{ brand }} is not responsible for the privacy practices of these other websites, apps, and services, and we recommend that you review the privacy policies of each of these websites, apps, or services before sharing any personal data.

We reserve the right to change the {{ breadcrumb }} from time to time without notice. You acknowledge and agree that it is your responsibility to review the {{ breadcrumb }} periodically to familiarize yourself with any modifications. Your continued use of this site after such modifications will constitute acknowledgment and agreement of the modified {{ breadcrumb }}.

## Information We Collect:
We collect your name, email, and IP, and other various data points about portions of {{ brand }} services that you may use. We use Google Analytics both on the website and in the application to enhance your {{ brand }} experience. We use cookies to collect, track, and monitor data both on the website and in the application. We do this so that we can improve the functionality of our products and ensure the safety, integrity, and fairness of users. You can read our [cookie policy here]({{ site.url }}/cookies/).

See How Google uses data when you use our partners' sites or apps located at [www.google.com/policies/privacy/partners/](https://www.google.com/policies/privacy/partners/) for more information.

We collect some or all of this information in the following cases:
* You register as a member on this site.
* You fill out our contact form.
* You browse this site.
* You use our app.
* You fill out fields on your profile.

We may collect non-personally identifiable information about you in the course of your interaction with our site. This information may include technical information about the browser or type of device you're using. This information will be used purely for the purposes of analytics and tracking the number of visitors to our site.

By voluntarily providing us with Personal Data, you are consenting to our use of it in accordance with this Privacy Policy.

## How We Use Your Information:
Your email is used solely for the purpose of logging into your personal account and making you a registered member of the site and app. We may also send promotional and marketing emails to you.

Google Analytics may track additional information such as IPs which we use for marketing purposes.

We may use your email address to inform you of activity on our site or to send {{ brand }} promotions.

Your IP address is recorded when you perform certain actions on our site. Your IP address is never publicly visible.

In an ongoing effort to better understand and serve the users of the {{ brand }} Services, {{ brand }} often conducts research on its customer demographics, interests, and behavior based on the Personal Data and other information provided to us. This research may be compiled and analyzed on an aggregate basis, and {{ brand }} may share this aggregate data with its affiliates, agents, and business partners. This aggregate information does not identify you personally. {{ brand }} may also disclose aggregated user statistics in order to describe our services to current and prospective business partners, and to other third parties for other lawful purposes.

## How Our Data is Stored and Kept Secure
We are committed to ensuring that any information you provide to us is secure. In order to prevent unauthorized access or disclosure, we have put in place suitable measures and procedures to safeguard and secure the information we collect.

## Sharing of Your Information:
We will not rent or sell your information to third parties outside of {{ brand }} and its affiliates without your consent.
In the event of a change of control, if we sell or otherwise transfer part or the whole of {{ brand }} or our assets to another organization (e.g., in the course of a transaction like a merger, acquisition, bankruptcy, dissolution, liquidation), your information such as name and email address, User Content, and any other information collected through the Service may be among the items sold or transferred. You will continue to own your User Content. The buyer or transferee will have to honor the commitments we have made in this Privacy Policy.

## How We Store Your Information

### Your Choices About Your Information:
Your account information and profile privacy settings can be updated or changed by visiting your account profile at [{{ site.url }}/account]({{ site.url }}/account) or by contacting {{ brand }} directly at [{{ site.url }}/contact]({{ site.url }}/contact).
- You may request to have your account deleted by visiting your account profile at [{{ site.url }}/account]({{ site.url }}/account#deleteAccount).
- You may request to unsubscribe from emails by clicking the "unsubscribe" link inside the email.

## Children’s Privacy:
When it comes to the collection of personal information from children under 13, the Children’s Online Privacy Protection Act (COPPA) puts parents in control. The Federal Trade Commission, the nation’s consumer protection agency, enforces the COPPA Rule, which spells out what operators of websites and online services must do to protect children’s privacy and safety online. We do not specifically market to children under 13.

## SMS Opt-In Policy
By opting in to receive SMS communications from {{ brand }}, you agree to receive marketing text messages, such as promotions and cart reminders, from us. Consent to receive marketing text messages is not a condition of any purchase. Message and data rates may apply, and the frequency of messages may vary. You may unsubscribe from receiving SMS messages at any time by replying “STOP” to any message or by clicking the unsubscribe link provided in our communications. For more information about our privacy practices, please refer to this Privacy Policy or our [Terms of Service]({{ site.url }}/terms/).

## Request Your Data to Be Removed or Deleted
If you would like your personally identifiable information to be deleted from our database, you can request deletion here: [{{ site.url }}/account]({{ site.url }}/account#deleteAccount).

## Acceptance of This Policy
Use of our site signifies your acceptance of this policy. If you do not accept the policy then please do not use this site. When registering, we will further request your explicit acceptance of the privacy policy.

{{ content | liquify | markdownify }}

## How to Contact Us:
You can contact us at: [{{ site.url }}/contact]({{ site.url }}/contact).
