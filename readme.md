# Plan My C-Day

Created by Nora Im for the Congressional App Challenge.

Plan My C-Day is a mobile app that brings daily planning, personal growth, and healthy habits together in one place. It helps users organize their day, explore activities and challenges, and stay motivated as they make progress.

## Features

- **Daily planning:** Organize your C-Day activities.
- **Explore:** Discover challenges and inspiration.
- **Personal growth:** Track progress and earn Leaf XP rewards.
- **Nutrition:** Explore nutrition and recipe content.
- **Community:** Connect through shared activities and content.

## Try the beta

Plan My C-Day is available for beta testing on iPhone through Apple TestFlight.

**Minors ages 13–17 must have parental consent to try the beta version.**

If you're interested in testing the app, contact the developer at **support@mycday.com** to request a TestFlight invitation link.

### How to install and try it

1. Install Apple TestFlight on your iPhone.
2. Request an invitation link by emailing support@mycday.com.
3. Open the invitation link on your iPhone and follow the prompts to install Plan My C-Day.
4. Open the app to explore its features.

Send feedback or report problems to **support@mycday.com**.

## Source code

The mobile application's source code is in the `mobile` folder.

The app is built with:

- React Native and Expo
- TypeScript
- Supabase

- ## Run the source code

### Requirements

- Node.js and npm compatible with the project's Expo version
- Git
- For an iOS build: a Mac with Xcode and an iOS Simulator
- A configured Supabase backend for this app

### Setup

1. Download the repository and install dependencies:

   ```bash
   git clone https://github.com/Norochka2010/Plan-My-C-Day.git
   cd Plan-My-C-Day/mobile
   npm install
   ```

2. Create a `.env.local` file inside `mobile` containing your backend's values:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```

   Use a publishable client key, never a service-role key.

3. Build and run on an iOS Simulator:

   ```bash
   npm run ios
   ```

   To start the Expo development server separately:

   ```bash
   npm start
   ```

### Backend requirements

The app requires its Supabase database schema, content, authentication configuration, and supporting functions. An empty Supabase project is not sufficient.

Database migrations are in `mobile/supabase/migrations`, additional SQL scripts are in `mobile/supabase`, and server functions are in `mobile/supabase/functions`.

A complete fresh-backend setup has not yet been verified. Contact support@mycday.com for development setup assistance. To try the working beta, use the TestFlight instructions above.
