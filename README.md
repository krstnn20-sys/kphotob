This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Download and print

After editing a strip, use **Download & print**. Photos are composed in the browser and never uploaded to Vercel Blob or another cloud store.

### Local commands

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
```

### Testing download

1. Finish a session to reach the save screen.
2. Choose **Download Photo Strip** (or **Download / Save to Gallery** on a phone).
3. Confirm a file named like `kixclicks-photo-strip-YYYYMMDD-HHmmss.png`.
4. On iPhone, pick **Save to Photos** from the share sheet. On Android, pick Gallery / Downloads.

### Testing browser printing

1. On the result screen, choose **Print Photo Strip**.
2. Leave the method on **Browser / system printer**.
3. Choose paper (Fit page, 4×6, Letter, or thermal widths) and copies (1–10).
4. Wait for the preview to load, then confirm in the system dialog. Opening the dialog is not treated as proof that paper came out.
5. Websites cannot print silently. iOS Safari may require Print from the share sheet.

### Direct thermal printers

A Vercel deployment cannot talk to USB/Bluetooth hardware. Use browser printing, or run `node print-bridge/server.mjs` on the computer attached to the printer, then add a vendor/ESC/POS adapter for that exact model. See `print-bridge/README.md`.

No Blob, site URL, or cron environment variables are required for this app. If older sharing variables remain on the Vercel project, they can be removed after this version is deployed.
