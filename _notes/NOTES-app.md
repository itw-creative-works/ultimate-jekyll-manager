{
  "server": "https://us-central1-studymonkey-ai.cloudfunctions.net",
  "images": {
    "combomark": "https://cdn.itwcreativeworks.com/assets/studymonkey/images/logo/studymonkey-combomark-black-1024x.png",
    "brandmark": "https://cdn.itwcreativeworks.com/assets/studymonkey/images/logo/studymonkey-brandmark-black-1024x1024.png",
    "wordmark": "https://cdn.itwcreativeworks.com/assets/studymonkey/images/logo/studymonkey-wordmark-black-1024x.png"
  },
  "github": {
    "repo": "studymonkey-website",
    "user": "ianwieds"
  },
  "apiKeys": {
    "stripe": {
      "publishableKey": "pk_live_51Mirn8HGybgi7uQGuE5IcaED0VByYRfVXGUmBDqnUyldcf2BJrpiFCDmwu4NoSDv34LMBw5mfCNdB3pmRki0jhmx00jFgW4akz"
    },
    "chatsy": {
      "accountId": "EG6j4wzyykSrHluANgIVTvyjzyu1",
      "chatId": "LP8IKB0sRjARSO"
    },
    "paypal": {
      "clientId": "AQSXMAqVuJYriyKEpaEc9xhS4hkm7iSlLjNRXSBdkM234figh599SMQbc0VMfYrm2Vh74J3u4jdeFYH9"
    },
    "chargebee": {
      "siteKey": ""
    }
  },
  "oauth2": {
    "discord": {
      "scope": ["identify", "guilds", "guilds.join"],
      "enabled": true
    },
    "google": {
      "enabled": false
    }
  },
  "url": "https://studymonkey.ai",
  "products": {
    "studymonkey-homework-helper": {
      "successURLText": "Start Studying!",
      "name": "StudyMonkey Homework Helper",
      "monthly": {
        "stripeProductId": "prod_NTqQASoK03O5fP",
        "price": 8,
        "chargebeePlanId": "",
        "paypalPlanId": "plan.id",
        "stripePriceId": "price_1MisjzHGybgi7uQGw5MH7VZx"
      },
      "successURL": "https://studymonkey.ai/dashboard",
      "planId": "homework-helper",
      "spreadsheetId": "1d0elQATs7mpur6IwlyWy_7s2vWvUZYT0nfF2WtTiKjQ",
      "type": "subscription",
      "limits": {
        "devices": 3,
        "requests": 50
      },
      "trial": 14,
      "annually": {
        "stripeProductId": "prod_NTqYLkXCOhAwa5",
        "price": 72,
        "chargebeePlanId": "",
        "paypalPlanId": "plan.id",
        "stripePriceId": "price_1MisrnHGybgi7uQGn0XOVjRo"
      }
    }
  },
  "reviews": {
    "sites": ["https://www.trustpilot.com/review/studymonkey.ai"]
  },
  "name": "StudyMonkey",
  "id": "studymonkey",
  "brand": {
    "description": "StudyMonkey is an AI-powered tutor that helps you with your homework and studying."
  },
  "dashboard": true,
  "email": "support@studymonkey.ai",
  "sponsorships": {
    "acceptable": ["education", "academic"],
    "unacceptable": ["online homework services", "essay writing service", "online writing services"],
    "prices": {
      "guest-post": 40,
      "link-insertion": 30
    }
  },
  "authentication": {
    "password": {
      "enabled": true
    },
    "google.com": {
      "enabled": true
    }
  }
}
