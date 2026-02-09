---
### ALL PAGES ###
layout: blueprint/alternatives/alternative
sitemap:
  include: true

### PAGE CONFIG ###
draft: true  # Hide from listing and sitemap (only visible in development)

### ALTERNATIVE CONFIG ###
# Only competitor-specific data is needed here.
# Shared content (testimonials, stats, FAQs, CTA, why_switch) is inherited from the layout.
# Override any inherited section by defining it here.
alternative:
  competitor:
    name: "ExampleApp"
    description: "ExampleApp is a basic project management tool with limited features and outdated design."

  comparison:
    features:
      - name: "Free Plan"
        icon: "gift"
        ours:
          value: true
        theirs:
          value: true
      - name: "AI-Powered Features"
        icon: "sparkles"
        ours:
          value: "Advanced"
        theirs:
          value: "Basic"
      - name: "Real-time Collaboration"
        icon: "users"
        ours:
          value: true
        theirs:
          value: false
      - name: "API Access"
        icon: "code"
        ours:
          value: "Full REST API"
        theirs:
          value: "Limited"
      - name: "Custom Branding"
        icon: "palette"
        ours:
          value: true
        theirs:
          value: false
      - name: "Priority Support"
        icon: "headset"
        ours:
          value: "24/7"
        theirs:
          value: "Business hours"
      - name: "Integrations"
        icon: "plug"
        ours:
          value: "200+"
        theirs:
          value: "50+"
      - name: "Mobile App"
        icon: "mobile"
        ours:
          value: true
        theirs:
          value: true
      - name: "Export Formats"
        icon: "download"
        ours:
          value: "PDF, CSV, JSON"
        theirs:
          value: "CSV only"
      - name: "Uptime SLA"
        icon: "shield-check"
        ours:
          value: "99.99%"
        theirs:
          value: "99.5%"
---
