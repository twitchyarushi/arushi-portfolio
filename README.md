# Arushi Manoj – portfolio

Next.js 15 + TypeScript, plain CSS (no Tailwind). Rebuilt from the Figma "final landing" frame.

    npm install
    npm run dev      # http://localhost:3000
    npm run build && npm start

- `src/components/desk-data.tsx` – positions (desktop = Figma px, mobile = 430-wide units) and all page content
- `src/components/Desk.tsx` – the page, eye-follow, popups
- `src/app/scrapbook.css` – layout, hover animations, responsive rules
- `public/scrapbook/` – your original stickers + the Figma renders (banner, signature, torn paper, notepad paper, clip, envelope)
