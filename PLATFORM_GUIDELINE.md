# Addis Psychology Platform Guideline

> Historical design reference: the description below documents the original demo. See `SETUP.md` for the current Supabase/R2 messaging implementation, removed demo data, disabled payment/booking/admin flows, and deployment instructions.

## 1. Overview

Addis Psychology Platform is a demo mental health support platform designed to connect people with licensed mental health professionals in Addis Ababa. It combines therapist discovery, appointment booking, asynchronous messaging, and practice management in one experience.

The platform is built for two main audiences:

- Clients seeking emotional support, therapy, or counseling
- Therapists and clinicians who want to present their practice, manage availability, and engage with clients

It is intentionally designed as an interactive demonstration rather than a live clinical service. No real payments are processed, no actual appointments are scheduled with real providers, and all availability, chat interactions, and bookings are simulated for demonstration purposes.

---

## 2. Platform Purpose and Design Principles

The platform is intended to feel:

- Human and calm
- Respectful of privacy
- Easy to browse for first-time users
- Flexible for both online and in-person care
- Accessible in English and Amharic
- Structured around practical care journeys rather than complicated admin work

The user experience is centered on three core actions:

1. Discover a suitable therapist
2. Choose a care path (chat, booking, or both)
3. Continue the care flow through a clear and guided interface

---

## 3. Navigation and Structure

The platform includes the following main sections:

- Home and onboarding
- Therapist directory
- Chat and message packages
- Appointment scheduling
- Booking review and confirmation
- My bookings
- Therapist portal
- Therapist registration
- Admin console

The navigation is available across the top of the app and is designed to be simple and direct. Users can switch language, change theme, and quickly reach chat or therapist options.

### Language support

The app supports:

- English
- Amharic

This bilingual support is available across key actions such as navigation labels, booking labels, therapist details, and confirmation messages. The interface is meant to feel natural for both English-speaking and Amharic-speaking users.

### Theme support

The interface also supports different visual themes:

- Light theme
- Dark theme
- Color theme

This is a presentation feature intended to make the demo more flexible without affecting the underlying platform flows.

---

## 4. Home Experience and First-Time Onboarding

The landing experience begins with an emotionally supportive message that emphasizes that users do not need to manage their struggles alone.

### Home message

The platform presents a clear emotional promise:

- Support should feel human
- Privacy matters
- Care should not feel rushed
- Clients should be able to find help on their own schedule and in their own language

### Onboarding flow

The onboarding process asks a few simple questions to help the user begin in a low-pressure way:

- How should we address you?
- What brings you here?
- What kind of care do you prefer?

The user can choose concerns such as:

- Anxiety and stress
- Low mood and depression
- Relationships and couples issues
- Grief and loss
- Self-confidence challenges
- Other personal concerns

The onboarding also allows the user to choose their preferred connection type:

- Video sessions
- In-person sessions
- Text and voice chat

This is designed to personalize the experience without requiring a detailed clinical intake at the first step.

### Goal of onboarding

The onboarding experience helps users feel comfortable before reaching the therapist directory. It is intentionally simple and supportive, not clinical or intimidating.

---

## 5. Therapist Directory

The therapist directory is the main discovery area for clients.

### What users can do here

- Search by therapist name
- Search by specialty or language
- Filter by availability
- Filter by saved therapists
- View therapist profiles and credentials
- Check pricing
- Start a quick booking
- Open chat with a therapist
- Save therapists for later

### Therapist profile information

Each therapist card includes:

- Name and professional title
- Specialist areas
- Languages spoken
- Years of experience
- Ratings and review count
- Session pricing
- Availability status
- Profile photo placeholder or avatar

Examples of therapist types include:

- Clinical psychologists
- Psychotherapists
- Counselors
- Child and adolescent specialists
- Psychiatrists

### Availability status

Each therapist has a visible presence state:

- Online and available
- Online but in session
- Offline

This helps users understand whether a therapist is ready to chat or whether they should message asynchronously.

### Saving therapists

Users can save therapists in a shortlist for later reference. This helps if the user wants to compare clinicians or return to a preferred provider later.

### Quick booking

The directory supports a quick-book flow that quickly selects an available time slot for the user, making it easier to progress from browsing to booking without needing to navigate multiple steps manually.

---

## 6. Therapist Profiles and Credentials

Users can open a full therapist profile to explore more detail.

The profile includes:

- Education history
- Professional background
- Approaches used in care
- Clinical specialties
- Languages spoken
- Price information
- Professional badges or status markers

This allows clients to make an informed decision based on fit, not just availability.

The profile view is designed to be more editorial and reassuring than a conventional clinic directory. It emphasizes trust, warmth, and competence.

---

## 7. Scheduling and Appointment Booking

The booking flow is structured in a clear three-step journey:

1. Select therapist
2. Choose appointment date and time
3. Review and confirm

### Session types

Users can choose between:

- Online video session
- In-person visit

### Time selection

The scheduling interface shows a weekly calendar and allows the user to choose from available time slots. The platform checks for:

- Therapist working days
- Existing bookings
- Future slot validity
- Session availability windows

The displayed time slots are blocked when they are already taken or unavailable.

### Pricing during booking

The session price changes depending on:

- Therapist
- Session format
- Any active discount

The platform presents both online and in-person costs side by side so users can compare options.

### Booking review

Before finalizing, the user sees a review screen showing:

- Therapist name
- Date and time
- Session format
- Total fee
- Client name field for the demo booking

The booking is presented as a demo request rather than a live commercial transaction.

### Confirmation outcome

Once confirmed, the booking appears in the client’s booking list and the therapist portal. The message clearly states that this is a demo request and not a real appointment or payment.

---

## 8. My Bookings

The client-facing bookings area gives the user a list of scheduled or pending appointments.

### What is shown

- Appointment date
- Time
- Therapist name
- Session format
- Booking status

### Typical statuses

- Pending
- Confirmed
- Cancelled
- Completed

This area helps the user keep track of upcoming or past requests in an easy and readable way.

The platform uses this area both as a booking record and as a confirmation checkpoint that the user can return to after scheduling.

---

## 9. Chat and Messaging Experience

The chat feature is a central part of the platform and supports a more flexible form of care than scheduled appointments.

### Asynchronous message model

Clients can send:

- Text messages
- Voice notes

The system is designed around prepaid credits rather than an active live subscription model.

### Chat flow

The user selects a therapist, opens a message thread, and can send messages from their own pace. The therapist may reply at a later time depending on schedule and availability.

### Availability and response timing

A therapist may be:

- Available now for chat
- Offline
- In session
- Usually replying only during scheduled chat hours

This keeps expectation-setting realistic and prevents the platform from feeling like an emergency service.

### Voice notes

The chat interface supports a hold-to-record voice capture flow:

- User presses and holds the record button
- A microphone permission prompt may appear
- The user records a voice note
- Releasing the button sends the note
- Dragging the button away cancels the recording

This interaction allows clients to send voice messages without requiring a scheduled video call.

### Therapist simulation

The chat is built as an interactive demo. When the user sends a message, a therapist reply is simulated after a short delay. This shows a realistic back-and-forth conversation without requiring a live operator.

### Conversation starters

The app includes pre-written prompts to help clients begin conversations, such as:

- Stress and overwhelm
- Grounding techniques
- Transitions and personal change
- Breathing exercises

These prompts make it easier for users to start the conversation and reduce the fear of blank messaging.

---

## 10. Chat Packages and Credits

The platform offers prepaid message packages as an alternative or companion to formal appointment booking.

### Package purpose

This allows users to buy a bundle of credits for a therapist without subscribing to a monthly service.

### Common package types

- Text credits
- Voice credits
- Combined text and voice bundles

### Pricing model

The app shows pricing clearly in the package flow:

- Text messages have a per-message cost
- Voice notes are charged by time used
- Discounts may appear based on therapist settings

The purchase flow is explicitly presented as a demo transaction, not a real financial charge.

### Package usage rules

Credits belong to the selected therapist only. Unused demo credits remain available for demonstration use, and packages do not automatically expire in the demo environment.

### How users buy packages

The flow includes:

- Selecting a package
- Reviewing the total cost
- Confirming a demo purchase
- Opening the conversation immediately after purchase

This makes the chat experience feel active and complete even in a demo environment.

---

## 11. Therapist Portal

The therapist portal is the operational workspace for practitioners.

### Main portal purpose

This area lets therapists manage their practice and monitor the demo environment from a single dashboard.

### Core portal features

- Switch between practitioners
- Set online status
- View overview metrics
- Review live chat messages
- Manage calendar bookings
- Adjust rates and scheduling
- Update profile and bio
- Register a new practitioner

### Presence controls

Therapists can choose status states:

- Available
- In session
- Offline

This status is reflected in the public directory and chat features.

### Portal tabs

The therapist portal includes tabs for:

- Overview
- Live chat desk
- Calendar and bookings
- Rates and schedule
- Profile and bio

### Overview tab

This section shows summary metrics such as:

- Today’s appointments
- Pending bookings
- Live chat count
- Simulated practice revenue

This helps the therapist understand demand and activity at a glance.

### Chat desk tab

The therapist can:

- Read incoming messages
- Reply to clients
- Send text replies
- Record and send voice notes
- View live message history

The interface supports a natural conversation flow and helps simulate what a care conversation might look like in a supportive digital environment.

### Calendar and bookings tab

This shows all upcoming or active bookings related to that therapist. It helps maintain a simple overview of confirmed and pending sessions.

### Rates and schedule tab

Therapists can update:

- Consultation prices
- Discount percentages
- Working days
- Session hours
- Chat hours

This is useful for demonstrating how a practice settings dashboard would operate in a live platform.

### Profile and bio tab

The therapist can manage identity information such as:

- Title
- Bio
- Languages
- Specialties
- Professional image

This section is important because the public directory reflects these details.

---

## 12. Therapist Registration

The platform includes a clinician-facing registration flow for joining the network.

### Registration steps

The process is multi-step and includes:

- Identity and photo
- Credentials and professional details
- Practice focus and bio
- Review and launch

### Information collected

The therapist can provide:

- Full professional name
- Email address
- Phone contact
- Professional title
- License number
- Languages
- Clinical specialties
- Short bio
- Photo
- Session pricing

### Validation

The registration flow checks for missing or invalid details before continuing, such as:

- Missing name
- Invalid email
- Missing phone number
- Missing license
- No language selected
- Too-short bio
- No specialty selected

### After registration

Once submitted, the user is shown a success state that confirms the practice is active in the platform. They can immediately:

- Open the therapist portal
- View the public therapist directory listing
- Test the chat flow

This creates a complete lifecycle from joining to being visible to clients.

---

## 13. Admin Console

The admin console is the governance layer of the platform.

### Access

The admin area is protected by password access. The default demo password is shown in the interface for demonstration purposes.

The platform also offers quick demo access for testing without entering the password manually.

### Dashboard overview

The admin dashboard provides metrics such as:

- Total bookings
- Today’s bookings
- Package revenue
- Pending approvals
- Message totals
- Registered practitioner count

### Admin tabs

The admin workspace includes:

- Overview
- Therapists and applicants
- Bookings
- Messages
- Package sales
- Settings

### Role of admin

The admin can:

- Review practitioner applications
- Manage existing therapists
- Inspect bookings
- Search bookings by client or therapist
- Filter by appointment status
- Review message activity
- Monitor package sales
- Evaluate platform performance

### Booking management

Bookings can be filtered by status:

- All
- Pending
- Confirmed
- Cancelled
- Completed

Search can also match against client names or therapist names.

### Charting and reporting

The admin dashboard includes simple visual summaries such as:

- Bookings by therapist
- Revenue by therapist
- Performance comparison across practitioners

This makes the platform feel operational, not just decorative.

---

## 14. Demo Safety and Boundaries

This platform is explicitly a demonstration system.

### What it does not do

- It does not charge real money
- It does not arrange real therapeutic care
- It does not connect users to external healthcare systems
- It does not provide emergency mental health support
- It does not represent actual clinical operations

### What it does do

- Simulate therapist availability
- Simulate bookings and appointments
- Simulate message flows
- Demonstrate care journeys in a realistic but safe way

Every booking, package purchase, and chat interaction is clearly labeled or framed as a simulated experience.

---

## 15. Typical User Journeys

### Client journey

1. Open the platform and complete the onboarding flow
2. Explore the therapist directory
3. Filter by need, availability, or language
4. Read therapist profiles and pricing
5. Book a session or start a chat
6. Review the session or package purchase
7. Track appointments in the bookings list

### Therapist journey

1. Register a practice profile
2. Set availability, prices, and chat hours
3. Receive a public listing in the directory
4. View client bookings and messages
5. Manage appointment flow from the therapist portal
6. Use chat and voice notes to respond to clients

### Admin journey

1. Sign in to the admin console
2. Review platform metrics
3. Monitor bookings and package performance
4. Manage therapist records and approvals
5. Inspect live message and booking activity

---

## 16. Platform Goals

The platform is designed to make mental health support feel accessible and less intimidating by combining:

- Clear therapist discovery
- Flexible care types
- Simple scheduling
- Guided communication
- Thoughtful bilingual experience
- Strong demo safety boundaries

In short, it is a digital prototype for a compassionate mental health practice brand that helps people find support in a way that feels calm, organized, and respectful.

---

## 17. Recommended Usage Guidance for Team Members

When presenting or using the platform:

- Always frame it as a demo experience
- Explain that bookings and packages are simulated
- Clarify that no real payment or care is being delivered
- Highlight that the platform is designed for exploring UX and service flows
- Use the bilingual interface to demonstrate accessibility and cultural fit
- Emphasize the supportive tone of the experience and the emphasis on privacy and calm

---

## 18. Final Summary

Addis Psychology Platform is a demonstration mental health platform that helps people discover therapists, communicate through text and voice, schedule care, manage bookings, and operate a practice in a modern digital environment. The experience includes onboarding, directory search, profile review, asynchronous chat, pricing and packages, therapist registration, and an admin management console.

Its central value is not only technology, but trust: it presents mental health support as a warm, structured, and human-centered service that respects the user’s pace, language, and comfort level.
