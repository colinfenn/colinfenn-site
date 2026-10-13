# One-time setup for the editor

Colin posts videos at `https://colinfenn.com/admin`. Stats, the schedule, showcases, GPA, and the rest of the profile are in the full editor at `https://colinfenn.com/admin/advanced`. Both save the same JSON files the site already uses. Netlify then publishes the site again. There is no build step.

If GitHub login is already installed on colinfenn.com, there is nothing new to set up. The video page uses that same login. Skip to [How Colin uses it](#5-how-colin-uses-it). The steps below are the original one-time setup, kept here in case the site is ever linked again.

Do this once, on the **existing** colinfenn.com site. Don't make a second Netlify site, and don't choose "Push to new repository" — that would create a different GitHub repo.

## Why GitHub login

Netlify Identity still exists, but **Git Gateway is deprecated**. Git Gateway is the part that used to save Identity logins into GitHub. Netlify says not to turn it on for a new site, and they will not fix bugs in it.

This editor does not use Identity or Git Gateway. Colin signs in with a GitHub account that has permission to edit this repo. Netlify's GitHub OAuth screen is the login button. That is the supported setup for Decap CMS on Netlify today.

Colin needs his own free GitHub account. The editor will not work with only an email address.

## 1. Put this repo on the live site

1. Open the existing colinfenn.com project in Netlify.
2. Go to **Project configuration → Developer settings → Continuous deployment → Repository**.
3. Choose **Link repository** (not "Push to a new repository").
4. Pick GitHub, then the repo `colinfenn/colinfenn-site`.
5. If GitHub asks you to install the Netlify GitHub App, install it and give it access to that repo.
6. Set the production branch to **main**.
7. Leave the build command empty if Netlify shows a box for one. This repo's `netlify.toml` publishes the repo root (the publish directory is `.`) and runs no real build. If the command box shows `true`, leave it — that means "do nothing."
8. Save. Netlify will deploy. Wait until that deploy is published. The site should look the same, and `https://colinfenn.com/admin` should show a "Log in with GitHub" button. Login will not work until the next two steps are done.

## 2. Create the GitHub login app

1. On GitHub, open [Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) (your personal GitHub account is fine).
2. Click **New OAuth App** (it may say "Register a new application").
3. Fill it in exactly:
   - **Application name:** `Colin Fenn site editor`
   - **Homepage URL:** `https://colinfenn.com`
   - **Authorization callback URL:** `https://api.netlify.com/auth/done`
4. The callback URL has to be that exact address. Don't put colinfenn.com in the callback box.
5. Click **Register application**.
6. Copy the **Client ID**.
7. Click **Generate a new client secret**. Copy the secret now. GitHub will not show it again.

Don't put the client secret in this repo, in email, or in a text to Colin. It only goes into Netlify, in the next step. If it leaks, generate a new secret on the same GitHub page and paste the new one into Netlify.

## 3. Turn that login on in Netlify

1. In the colinfenn.com project, go to **Project configuration → Security → OAuth**.
   - Older screens say **Project configuration → Access & security → OAuth**. Same place.
2. Under **Authentication providers**, click **Install provider**.
3. Choose **GitHub**.
4. Paste the Client ID and Client Secret. Save.

## 4. Let Colin edit the repo

The login only works for GitHub users who can write to `colinfenn/colinfenn-site`.

1. Colin creates a free GitHub account if he doesn't have one, and sends you his GitHub username.
2. Open the repo on GitHub: `https://github.com/colinfenn/colinfenn-site`.
3. Go to **Settings → Collaborators** (it may say "Collaborators and teams").
4. Click **Add people**, enter his username, and give him the **Write** role.
5. He accepts the invite from his email or from GitHub notifications. Until he accepts, login will fail.

Anyone with Write access can change the live site from `/admin` or from GitHub. Only invite people who should be able to do that.

## 5. How Colin uses it

Day to day he uses the simple page, not the full editor.

1. On his phone, open `https://colinfenn.com/admin` (the live site, not a file on the phone).
2. Tap **Log in with GitHub** and approve the GitHub screen. It asks for access to his repositories so the page can save files. That's expected.
3. If no login window opens, the phone blocked the pop-up. Allow pop-ups for colinfenn.com and try again. The first login on a computer also works.
4. To keep it on his home screen: in Safari, tap Share, then **Add to Home Screen**. In Chrome, use the browser menu and **Add to Home screen** or **Install app**. The icon is a baseball.
5. Tap **Add Video**.
6. Choose a clip from the camera roll, record one, or paste a YouTube link. A video over 50 MB stays off the site. The page asks him to put that one on YouTube (unlisted is fine) and paste the link.
7. Tap a category: Pitching, Hitting, Fielding, Workouts/Training, or Game Highlights. Those words are the tabs on the site.
8. Tap the tags for that category. Pitching asks for the pitch, the camera angle, and Game or Bullpen. Hitting asks for the result, the pitch he faced, the batted ball, the angle, and Game or batting practice. Fielding asks for the play, the position (LF, CF, RF, or P), the angle, and Game or practice. Workouts ask for the workout type. Highlights skip extra tags. He can skip any tag.
9. Type a caption. The date starts as today. The title fills in from what he tapped, and he can change it. Speed (like 75 mph) and, for a game, the opponent are optional. **Feature this** puts that one clip in the highlight reel at the top of the site. Turning it on for a new clip replaces the old one.
10. Check the preview. It is the same card the site shows. Tap **Post it**. Leave the page open until it says **Posted**. Wi-Fi is easier than cell data.
11. The live site updates after Netlify finishes the deploy, usually a minute or two.
12. **My videos** lists what he posted. **Edit** changes the title, caption, category, tags, speed, opponent, or the feature switch. **Delete** takes the video off the site. Blank “Video coming soon” cards are tucked at the bottom so he can remove one after he replaces it.

Uploaded videos are stored in this repo under `media/videos`. YouTube links are stored as links. A phone video can be an MP4, MOV, or WebM. MOV is what an iPhone records, and it plays on iPhones.

Stats, the schedule, showcases, GPA, and the rest of the profile are at `https://colinfenn.com/admin/advanced`. Open that, log in, edit, then tap **Publish** and **Publish now**. GPA is under **Profile and GPA**, in the Academics section. Type `Placeholder` in a box that isn't ready yet. The site already treats that word as "not filled in."

## If login fails

- **"Login with GitHub" does nothing.** Allow pop-ups, or try a computer.
- **GitHub says the app isn't set up, or Netlify returns an error.** Check the callback URL is exactly `https://api.netlify.com/auth/done`, and that the Client ID and secret are saved on this Netlify site (the one that serves colinfenn.com).
- **He gets in but the save fails, or GitHub says he doesn't have permission.** He isn't a collaborator yet, or he hasn't accepted the invite, or the role isn't Write. On the full editor, the same problem shows up when **Publish** fails.
- **The admin page is a 404.** The main branch hasn't been deployed yet. Finish step 1 and wait for the deploy.
- **He posted a video but the live page didn't change.** Wait for the Netlify deploy to finish (Deploys tab). Then refresh. A hard refresh helps if the phone kept the old page.
- **A long video won't upload.** That's expected over 50 MB. He puts it on YouTube and pastes the link.
