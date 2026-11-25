# Where things live

Paths below are relative to your ComfyUI install (for example, `C:\ComfyUI`).

There is no separate “character database.” A **character** is an **identity RefMod** (face / person latents). Clothing is either a **wardrobe RefMod** or a still from the **wardrobe catalogue**. Captions you type (who / keep) are remembered in a small JSON library.

---

## 1. RefMods (characters, outfits, sets, voices)

**Folder:** `models/refmods/`

| What | Files |
| --- | --- |
| Character / outfit / background | `Name.safetensors` |
| Thumbnail for the picker | `Name.preview.jpg` (optional; bake or Create can make it) |
| Paired voice | often `Name_voice.safetensors` or a voice listed next to the visual |

**Subfolders** are real directories under `models/refmods/` (picker → New folder / Move). Create can drop a new file straight into a folder.

**Expand:**
- In-node **Create** (RefMod / Hybrid): drop stills ± audio → encodes into `models/refmods/`.
- Or **H3 Create RefMod** with a folder/path.
- Or copy finished `.safetensors` (+ preview) into `models/refmods/` yourself, then refresh the picker.

Roles on create/edit: `identity` (character), `wardrobe` (clothing set), `background`, `generic`, `voice`, etc.

---

## 2. “Created characters”

Same place as above. Create does **not** keep a second character store.

- Encode writes only under `models/refmods/` (plus preview / voice sidecars).
- Temp upload folders used during Create are deleted after encode.
- Source photos are **not** copied into the pack unless you put them there yourself.

To “have more characters”: create more identity RefMods, or drop more files into `models/refmods/`.

---

## 3. Clothing catalogue (Hybrid / Ref2VA stills)

**Inside this pack** (ships with the node):

```
ComfyUI-EM-Subject-Hot-Swap/
  data/
    wardrobe.json          ← catalogue index (categories + items)
    wardrobe/
      lingerie/…
      swim/…
      streetwear/…
      custom/              ← in-node Add clothing lands here
```

A pick on a row stores `wardrobe:<relative-photo-path>`. Nothing is copied into Comfy’s `input/` folder.

**Expand:**
- In Hybrid: add / drop clothing → writes image under `data/wardrobe/custom/` and appends `wardrobe.json`.
- Or add photos under `data/wardrobe/<category>/` and add matching entries in `wardrobe.json` (same shape as existing items).
- Or build a **wardrobe RefMod** in `models/refmods/` if you want latents instead of a still.

---

## 4. Who / keep memory (not the RefMod file)

When you Describe / type who + keep for an image or RefMod, the node remembers it here:

**File:** `user/default/h3subject/library.json`

(under Comfy’s user directory — usually `ComfyUI/user/default/…`)

This is shared by RefMod, Hybrid, and Ref2VA so re-picking the same file restores captions. It is **not** the character itself; delete it and the RefMods/wardrobe still work, captions just start blank again.

Legacy one-file-per-subject folders under `user/default/h3subjectref/subjects/` are migrated into `library.json` on first read.

---

## 5. Ref2VA / Hybrid picture rows (non-catalogue)

Plain image picks use Comfy’s **input** folder (`input/`), same as Load Image. Wardrobe picks use the pack catalogue above. Audio clips use Comfy’s annotated audio / input paths.

---

## 6. Resolution Selector

Lives in **ComfyUI-EllipsesMark**. No files on disk — aspect / megapixels / multiple only.

---

## Quick map

| Thing | On disk |
| --- | --- |
| Characters & other RefMods | `models/refmods/**/*.safetensors` |
| RefMod previews | `models/refmods/**/*.preview.jpg` |
| Organized groups | subfolders under `models/refmods/` |
| Shipped + custom clothing photos | `…/ComfyUI-EM-Subject-Hot-Swap/data/wardrobe/` |
| Clothing index | `…/data/wardrobe.json` |
| Saved who/keep text | `user/default/h3subject/library.json` |
| One-off stills / audio for Ref2VA | Comfy `input/` (and audio paths) |

---

## Typical workflow

1. **New character** — Create on RefMod/Hybrid (identity) → file appears in `models/refmods/` (optionally in a folder).
2. **Reuse** — picker → pick that RefMod; Looks shows embedded / preview stills.
3. **Outfit as still** — Hybrid wardrobe catalogue, or drop into `data/wardrobe/custom/`.
4. **Outfit as RefMod** — Create with role wardrobe → another file under `models/refmods/`.
5. **Captions stick** — who/keep auto-saved to `library.json` when you describe / edit.
6. **Draft** — tag subjects in detailed; turn on **subject reinforce** if you want `who` expanded into detailed only.
