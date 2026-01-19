---
description: Deploy the application to Vercel and apply database migrations
---

1.  **Check for Migrations**:
    Look at `supabase/migrations`. If there are new files that haven't been applied:
    ```bash
    npx supabase db push
    ```

2.  **Deploy to Vercel**:
    Deploy to production.
    // turbo
    ```bash
    npx vercel --prod
    ```

3.  **Verify**:
    Check the deployment URL returned by the command.
