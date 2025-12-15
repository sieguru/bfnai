# BFN K2 Document Structure

This document describes the structure of Swedish BFN (Bokföringsnämnden) K2 accounting standards documents (.docx format). Use this as context when working with document parsing, chunking, or RAG systems for these legal documents.

## Document Overview

**Document Type**: Swedish accounting standards for smaller companies
**Document Name**: Årsredovisning i mindre företag (K2) - BFNAR 2016:10
**Publisher**: Bokföringsnämnden (BFN) - Swedish Accounting Standards Board
**Format**: Microsoft Word (.docx)
**Language**: Swedish
**Target**: Smaller companies ("mindre företag") with simplified reporting requirements

---

## Key Differences from K3

| Aspect | K2 | K3 |
|--------|-----|-----|
| Target companies | Smaller companies only | Larger companies, required |
| Content type marker style | `Spalttext` | `Rubrik 6 - spaltrubrik` |
| Point numbering | Alphanumeric (1.1A, 1.1B) | Numeric only (1.1, 1.2) |
| Explicit punkt headings | Yes (`Rubrik 5 indrag`) | No |
| Top hierarchy level | Avsnitt (Section) | Kapitel (Chapter) |
| Total chapters | 21 | 38 |

---

## Document Hierarchy

### Level 0: Document Parts (Rubrik 1)

Major document divisions.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 1 indrag` | "Lagregler, allmänna råd (BFNAR 2016:10) och kommentarer" |

### Level 1: Avsnitt - Sections (Rubrik 2)

The document is divided into 9 main sections (Avsnitt I–IX).

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 2 indrag` | "Tillämpningar och principer", "Årsredovisningens utformning" |

**Avsnitt List**:
- Avsnitt I – Tillämpningar och principer
- Avsnitt II – Årsredovisningens utformning
- Avsnitt III – Förvaltningsberättelsen
- Avsnitt IV – Resultaträkning
- Avsnitt V – Balansräkning
- Avsnitt VI – Noter
- Avsnitt VII – Särskilda regler för koncerner/intresseföretag
- Avsnitt VIII – Särskilda regler vid byte till detta allmänna råd
- Avsnitt IX – Frivilligt upprättad kassaflödesanalys

### Level 2: Kapitel - Chapters (Rubrik 3)

Chapters within each Avsnitt, numbered 1-21.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 3 indrag` | "Tillämpning", "Redovisningsprinciper", "Rörelseintäkter" |

**Chapter List**:
1. Tillämpning
2. Redovisningsprinciper
3. Årsredovisningens utformning
4. Uppställningsformer för årsredovisningen
5. Förvaltningsberättelsen
6. Rörelseintäkter
7. Rörelsekostnader
8. Finansiella poster m.m.
9. Tillgångar
10. Immateriella och materiella anläggningstillgångar
11. Finansiella anläggningstillgångar
12. Varulager
13. Kortfristiga fordringar
14. Kortfristiga placeringar inklusive kassa och bank
15. Eget kapital och obeskattade reserver
16. Avsättningar
17. Skulder
18. Noter
19. Särskilda regler för koncerner/intresseföretag
20. Särskilda regler vid byte till detta allmänna råd
21. Frivilligt upprättad kassaflödesanalys

### Level 3: Subsections (Rubrik 4)

Topic subdivisions within chapters.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 4 indrag` | "Vilka företag får tillämpa detta allmänna råd", "Definitioner och förklaringar" |

### Level 4: Punkt References (Rubrik 5)

Explicit references to punkt numbers - **unique to K2**.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 5 indrag` | "Punkt 1.1A", "Punkt 1.1B", "Punkt 1.1C", "Punkt 2.4A" |

### Level 5: Term Definitions (Rubrik 6)

Specific terms within sections.

| Style Name | Example Text |
|------------|--------------|
| `Rubrik 6 indrag` | "Nettoomsättning", "Ekonomiska föreningar" |

---

## Content Types

Each section is preceeded by a section title and contains three primary content types, marked by `Spalttext`:

### 1. Allmänt råd group (General Advices)

The regulatory guidance from BFN.
Each general rule in this section has a unique punkt number. Paragraphs without a punkt number are parts of the preceeding punkt.

**Marker**: `Spalttext` with text "Allmänt råd"

**Body Styles**:
| Style Name | Description |
|------------|-------------|
| `Stycke 1 indrag` | Primary body text |
| `Stycke 1A indrag` | Alternative first paragraph (K2 specific) |
| `Stycke 1 indrag inget avstånd` | Body text without spacing |
| `Bokstavslista 1 indrag` | Lettered list items (a, b, c) |
| `Bokstavlista 2 indrag` | Secondary lettered list |

### 2. Kommentar (Commentary)

Explanatory commentary elaborating on the "Allmänt råd".

**Marker**: `Spalttext` with text "Kommentar"

**Body Styles**:
| Style Name | Description |
|------------|-------------|
| `Normal Indent` | Primary commentary text |
| `Normal indrag ej avstånd` | Commentary without spacing |
| `Punktlista indrag` | Bulleted list items |
| `Punktlista 2 indrag` | Secondary bulleted list |

### 3. Lagtext (Legal Text)

Quotations from Swedish law (ÅRL, ABL, etc.).

**Marker**: `Spalttext` with text "Lagtext"

**Body Styles**:
| Style Name | Description |
|------------|-------------|
| `Textruta indrag` | Legal text quotation box |
| `Numrerad lista textruta` | Numbered list within legal text |

---

## Point Numbering System (Punkt)

### Format
K2 uses alphanumeric point numbering:
- Base points: `1.1`, `1.2`, `1.3`, `2.1`, `2.2`, etc.
- Extended points: `1.1A`, `1.1B`, `1.1C`, `2.4A`, etc.

### Numbering Rules
1. Point numbers are explicitly referenced in `Rubrik 5 indrag` headings
2. Comments are associated with the most recent "Allmänt råd group"

### Cross-References
The document frequently references points:
- "enligt punkt 1.1A a" (according to point 1.1A item a)
- "se punkt 2.4" (see point 2.4)
- "punkterna 11.20 och 19.8" (points 11.20 and 19.8)

---

## Document Flow Pattern

K2 follows this typical pattern:

```
[Rubrik 4 indrag] Subsection Title
    [Spalttext] Lagtext                    ← Optional legal context
        [Textruta indrag] Legal quotation
    [Spalttext] Allmänt råd                ← punkt X.Y assigned
        [Stycke 1 indrag] Regulatory text
    [Rubrik 5 indrag] Punkt X.YA           ← Explicit punkt reference
        [Spalttext] Kommentar
            [Normal Indent] Explanation of punkt X.YA
    [Rubrik 5 indrag] Punkt X.YB           ← Another punkt reference
        [Spalttext] Kommentar
            [Normal Indent] Explanation of punkt X.YB
```

---

## Amendment References

K2 includes amendment references indicating when rules were added or modified:
- `(BFNAR 2020:5)` - Specific amendment
- `(BFNAR 2020:7)` - Specific amendment
- `(BFNAR 2025:2)` - Most recent amendments

These appear inline in the text, typically after the affected regel.

---

## Examples Section

K2 has an extensive examples section with specific styles:

| Style Name | Description |
|------------|-------------|
| `Rubrik 2 exempel indrag` | Example section header |
| `Rubrik 3 exempel indrag` | Example subsection |
| `Rubrik 4 exempel indrag` | Example detail |
| `Rubrik 5 exempel indrag` | Example sub-detail |
| `toc 6`, `toc 7` | Example TOC entries |

Example numbering follows pattern: `[chapter] [letter]`
- `5 a – Flerårsöversikt i ett konsultföretag`
- `6 b – Försäljning av vara som innefattar installation`
- `10 a – Förvärv av fastighet och avskrivning av byggnad`

---

## Styles to Ignore

These styles should be excluded from content processing:

| Style Name | Reason |
|------------|--------|
| `toc 1` - `toc 7` | Table of contents entries |
| `TOC Heading` | Table of contents header |
| `Title`, `Subtitle` | Document title (preamble) |
| `Uppdaterad datum` | Update date metadata |
| `Rubrik X exempel indrag` | Example sections (process separately if needed) |

---

## Special Company Type Rules

K2 has specific rules for different company types:

| Company Type | Swedish Name | Style Pattern |
|--------------|--------------|---------------|
| Limited companies | Aktiebolag | "Särskilda regler för aktiebolag" |
| Economic associations | Ekonomiska föreningar | "Särskilda regler för ekonomiska föreningar" |
| Trading partnerships | Handelsbolag | "Särskilda regler för handelsbolag" |
| Foundations | Stiftelser | "Särskilda regler för stiftelser" |
| Non-profit associations | Ideella föreningar | "Särskilda regler för ideella föreningar" |
| Common property associations | Samfällighetsföreningar | "Särskilda regler för samfällighetsföreningar" |
| Branches | Filialer | "Särskilda regler för filialer" |

---

## Chunking Strategy

### Recommended Approach
1. Group content by punkt number (explicit from Rubrik 5, or implied from Allmänt råd markers)
2. Associate Kommentar sections with their corresponding punkt
3. Include Lagtext as context when it precedes Allmänt råd

### Hierarchy Path Format
```
Kapitel [N] > [Kapitel Title] > [Subsection Title] > punkt [N.MA] > [content types]
```

Example:
```
Kapitel 1 > Tillämpning > Vilka företag får tillämpa detta allmänna råd > punkt 1.1A > [kommentar]
```

### Metadata to Preserve
- `chapterNumber`: Integer (1-21)
- `pointNumber`: String ("1.1", "1.1A", "2.4A")
- `contentTypes`: Array (["allmänt råd", "kommentar"])
- `sectionTitle`: String (Rubrik 3 text)
- `subsectionTitle`: String (Rubrik 4 text)
- `explicitPunktRef`: String (from Rubrik 5 heading, if present)

---

## Sample Parsed Structure

```javascript
{
  chapterNumber: 1,
  chapterTitle: "Kapitel 1 – Tillämpning",
  sections: [
    {
      title: "Vilka företag får tillämpa detta allmänna råd",
      punktReferences: [
        {
          pointNumber: "1.1",
          contentType: "allmänt råd",
          text: "Detta allmänna råd får endast tillämpas av företag..."
        },
        {
          pointNumber: "1.1A",
          explicit: true,
          contentType: "kommentar",
          text: "Mindre företag som är publika aktiebolag får inte..."
        }
      ]
    }
  ]
}
```

---

## Notes for Development

### Alphanumeric Point Numbers
K2 punkt numbers can include letter suffixes. Use regex pattern: `/\d+\.\d+[A-Z]?/`

### Point References in Commentary
Commentary often references other points. Consider extracting these for linking:
- "se punkt 1.1A a" → link to punkt 1.1A, item a
- "enligt punkterna 2.4 och 2.4A" → links to both

### Table Content
K2 contains many tables (859 `Tabelltext` occurrences). Tables are used for:
- Calculation examples
- Comparison charts
- Balance sheet examples

### Simplified vs K3
K2 is intentionally simplified. When in doubt about a topic not covered in K2, the user should refer to K3 (BFNAR 2012:1).

---

## Questions for Clarification

When extending this system, consider:

1. Should examples be chunked separately or integrated with related regelverket?
2. How should table content be handled in chunks?
3. Should company-type-specific rules be tagged for filtering?
4. How should cross-references between K2 and K3 be handled?
5. Should amendment references be extracted as separate metadata?
