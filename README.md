# Hongdae 360° fidelity test

Standalone Three.js equirectangular look-around of the Seoul Avatar web-track 시안  
`media/concept/implementable/web-hongdae-street.jpg`.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/ — drag / touch / arrow keys to look around.

### Minimal 3D road + person

Real mesh walk slice (not panorama):

```bash
npm run dev
```

Open http://127.0.0.1:5173/3d/ — **WASD** to walk, drag to orbit camera.

Code lives in `src/minimal-road/` with a road **chunk** module so zone streaming can plug in later. The root `/` 360 viewer is unchanged.

## Regenerate panorama

```bash
npm run make-equirect
```

Source concept must be at `public/concept-hongdae.jpg`.
