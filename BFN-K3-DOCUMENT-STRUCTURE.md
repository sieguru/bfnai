# BFN K3 Document Structure

This document describes the structure of Swedish BFN (Bokföringsnämnden) K3 accounting standards documents (.docx format). Use this as context when working with document parsing, chunking, or RAG systems for these legal documents.

## Document Overview

**Document Type**: Swedish accounting standards and guidance
**Publisher**: Bokföringsnämnden (BFN) - Swedish Accounting Standards Board
**Format**: Microsoft Word (.docx)
**Language**: Swedish

The K3 document "Årsredovisning och koncernredovisning" (Annual Report and Consolidated Financial Statements) contains guidance for BFNAR 2012:1.

---

## Document Hierarchy

### Level 1: Chapters (Kapitel)

Chapters are the top-level organizational unit, numbered 1-38.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 2 indrag` | "Tillämpning", "Begrepp och principer" |

**Chapter List**:
- Kapitel 1 – Tillämpning
- Kapitel 2 – Begrepp och principer
- Kapitel 3 – Utformning av de finansiella rapporterna
- Kapitel 4 – Balansräkning
- Kapitel 5 – Resultaträkning
- ... (continues to Kapitel 38)

### Level 2: Sections (Rubrik 3)

Sections within chapters covering specific topics.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 3 indrag` | "Tillämpningsområde", "Definitioner", "Grundläggande principer" |

### Level 3: Subsections (Rubrik 4, 5)

Further subdivision of sections.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 4 indrag` | "Fortlevnadsprincipen", "Konsekvent tillämpning" |
| `Rubrik 5 indrag` | "Begriplig, tillförlitlig, relevant och väsentlig information" |

### Level 4: Term Definitions (Rubrik 6)

Specific terms being defined within a section.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 6 indrag` | "Tillgångar", "Skulder", "Eget kapital" |

---

## Content Types

Each section contains three primary content types, marked by the style `Rubrik 6 - spaltrubrik`:

### 1. Allmänt råd (General Advice)

The actual regulatory guidance/recommendations from BFN.

**Marker**: `Rubrik 6 - spaltrubrik` with text "Allmänt råd"

**Body Styles**:
| Style Name | Description |
|------------|-------------|
| `Allmänt råd` | Primary body text |
| `Stycke 1` | Numbered paragraph |
| `Stycke 1 indrag` | Indented numbered paragraph |
| `Stycke 1 indrag inget avstånd` | Indented paragraph without spacing |
| `Bokstavslista 1 indrag` | Lettered list items (a, b, c) |

### 2. Kommentar (Commentary)

Explanatory commentary that elaborates on the preceding "Allmänt råd".

**Marker**: `Rubrik 6 - spaltrubrik` with text "Kommentar"

**Body Styles**:
| Style Name | Description |
|------------|-------------|
| `Normal Indent` | Primary commentary text |
| `Normal indrag ej avstånd` | Commentary without spacing |
| `Punktlista indrag` | Bulleted list items |

### 3. Lagtext (Legal Text)

Quotations from Swedish law (ÅRL, etc.).

**Marker**: `Rubrik 6 - spaltrubrik` with text "Lagtext"

**Body Styles**:
| Style Name | Description |
|------------|-------------|
| `Textruta indrag` | Legal text quotation |
| `Numrerad lista textruta` | Numbered list within legal text |

---

## Point Numbering System (Punkt)

### Format
Points are numbered as `[chapter].[sequence]`:
- `punkt 1.1` - First allmänt råd in Chapter 1
- `punkt 2.12` - Twelfth allmänt råd in Chapter 2
- `punkt 35.4` - Fourth allmänt råd in Chapter 35

### Numbering Rules
1. Each chapter starts numbering from 1
2. Only "Allmänt råd" sections increment the counter
3. "Kommentar" sections are associated with the preceding punkt number
4. "Lagtext" sections do not have punkt numbers
5. Point numbers are implicit (determined by document order, not written in text)

### Cross-References
The document frequently references points:
- "enligt punkt 2.18" (according to point 2.18)
- "se punkt 3.8" (see point 3.8)
- "punkterna 3.10–3.14" (points 3.10-3.14)

---

## Document Flow Pattern

A typical section follows this pattern:

```
[Rubrik 3 indrag] Section Title
    [Rubrik 6 - spaltrubrik] Lagtext          ← Optional legal context
        [Textruta indrag] Legal quotation
    [Rubrik 6 - spaltrubrik] Allmänt råd      ← punkt X.Y assigned
        [Stycke 1 indrag] Regulatory text
    [Rubrik 6 - spaltrubrik] Kommentar        ← Associated with punkt X.Y
        [Normal Indent] Explanatory text
    [Rubrik 6 - spaltrubrik] Allmänt råd      ← punkt X.Y+1 assigned
        [Stycke 1 indrag] More regulatory text
    [Rubrik 6 - spaltrubrik] Kommentar        ← Associated with punkt X.Y+1
        [Normal Indent] More explanatory text
```

---

## Styles to Ignore

These styles should be excluded from content processing:

| Style Name | Reason |
|------------|--------|
| `toc 1`, `toc 2`, `toc 3` | Table of contents entries |
| `TOC Heading` | Table of contents header |
| `Title` | Document title (preamble) |
| `Subtitle` | Document subtitle (preamble) |
| `Uppdaterad datum` | Update date metadata |

---

## Chunking Strategy

### Recommended Approach
Group content by punkt number, combining:
1. The "Allmänt råd" paragraph(s)
2. Associated "Kommentar" paragraph(s)

### Hierarchy Path Format
```
Kapitel [N] > [Section Title] > [Subsection Title] > punkt [N.M] > [content types]
```

Example:
```
Kapitel 2 > Grundläggande principer > Fortlevnadsprincipen > punkt 2.2 > [allmänt råd, kommentar]
```

### Metadata to Preserve
- `chapterNumber`: Integer (1-38)
- `pointNumber`: String ("2.12")
- `contentTypes`: Array (["allmänt råd", "kommentar"])
- `sectionTitle`: String
- `subsectionTitle`: String (optional)

---

## Sample Parsed Structure

```javascript
{
  chapterNumber: 2,
  chapterTitle: "Kapitel 2 – Begrepp och principer",
  sections: [
    {
      title: "Grundläggande principer",
      subsections: [
        {
          title: "Fortlevnadsprincipen",
          points: [
            {
              pointNumber: "2.2",
              allmantRad: "Om det vid bedömningen av företagets fortlevnadsförmåga...",
              kommentar: "En finansiell rapport ska upprättas utifrån fortlevnadsprincipen..."
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Notes for Development

### Swedish Characters
The document uses Swedish characters (å, ä, ö) extensively. Ensure UTF-8 encoding throughout.

### Style Name Variations
Some styles may have variations:
- `Rubrik 2` vs `Rubrik 2 indrag`
- `Normal` vs `Normal Indent` vs `Normal BFN`

### Empty Paragraphs
Skip paragraphs with empty or whitespace-only text.

### Amendment References
Some points include amendment references like `(BFNAR 2012:5)` or `(BFNAR 2016:9)` indicating when the rule was added or modified.

---

## Questions for Clarification

When extending this system, consider:

1. Should "Lagtext" be included in the same chunk as the following "Allmänt råd"?
2. How should cross-references (punkt X.Y) be handled for linking?
3. Should amendment references be extracted as separate metadata?
4. How should tables within the document be handled?
5. Are there other document types (K2, K4) with different structures?
