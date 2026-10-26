# Setting up the friends leaderboard (Supabase)

The game already has the leaderboard built in. It stays hidden until it's
connected to your own free Supabase database. Setup takes about 10 minutes.

## 1. Create the database

1. Go to https://supabase.com and sign up (free).
2. Click **New project**.
   - **Name:** `fruit-picnic`
   - **Database password:** click **Generate a password** and save it
     somewhere safe. The game doesn't need it.
   - **Region:** the one closest to you and your friends.
3. Wait a minute or two while it sets up.

## 2. Add the leaderboard table

1. In the left sidebar, open **SQL Editor**, then click **New query**.
2. Open `supabase/leaderboard.sql` from this project, copy all of it, and paste
   it into the editor.
3. Press **Run**. It should say "Success. No rows returned."

## 3. Copy two values into the chat

Open **Project Settings → API Keys**, or click the **Connect** button at the
top of the project. Copy these two values:

- **Project URL:** looks like `https://abcdefghijkl.supabase.co`
- **Publishable key:** starts with `sb_publishable_`. On older projects it's
  called the **anon public** key and starts with `eyJ`.

Paste both into the chat with Claude. They go into `leaderboard.js` at the top.

**Don't** share the **secret** or **service_role** key. It isn't needed and must
stay private.

## How it works

- After a game ends, players type a name once and tap **Post**. After that,
  every finished game is posted automatically.
- Each phone appears once on the board, with its best score.
- The 🏆 button shows the top 15, for **Everyone** or for a friend group.
- Scores made offline are posted the next time the game is online.
- Players can remove their own name and score from the leaderboard screen.
  They can't edit or delete other people's scores. You can, in Supabase under
  **Table Editor → scores**.
- The privacy policy is `privacy.html` (https://fruitpicnic.io/privacy.html).
  It's linked from Settings, the leaderboard and the name box.

## Updating the database

When `supabase/leaderboard.sql` changes, run the whole file again in the SQL
Editor (step 2). It keeps all existing scores. Run it **before** publishing the
new version of the game, because the new game uses the new functions.

## Friend groups

- **＋ Groups** on the leaderboard lets players start a group (they get a code
  like `PLUM-4827` to share) or join one by typing a code.
- Invite links look like `https://fruitpicnic.io/?join=PLUM-4827`. They open the
  website and offer to join. In the iPhone app players type the code instead.
- Each group shows only its members' best scores. A group with no members left
  is deleted. Groups are in **Table Editor → groups** and **group_members**.

## Keeping names friendly

- Names must be 2–20 characters: letters, numbers, spaces and `. - _ '`. No
  links. Group names follow the same rules, up to 24 characters.
- Names are checked against **Table Editor → blocked_words**. Add a word there
  to block it (lowercase letters only):
  - `part` blocks it anywhere, even split up or disguised (`f.u.c.k`, `sh1t`).
  - `word` blocks it only as a whole word. Use this for short words that hide
    inside normal names, like `ass` in "Cassie".
- Players can tap a name to **Hide this player** (only on their phone) or
  **Report name**. A name reported by two different players shows as
  "Picnic Player" for everyone.
- **Reviewing reports:** open **Table Editor → reports** to see which names were
  reported (the `target` matches `public_id` in **scores**). In **scores**:
  - The name is fine: set `hidden` back to `false` and delete its rows in
    **reports**.
  - The name isn't OK: leave it hidden, or delete the row.
  - A player who changes their name gets a fresh start automatically.
