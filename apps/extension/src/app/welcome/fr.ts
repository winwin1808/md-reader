export const FR = `# Bienvenue dans MD Reader

MD Reader vous permet de lire, modifier et présenter des fichiers Markdown directement dans votre navigateur. Ce court document d'exemple vous aidera à démarrer.

---

## Lire

Ouvrez un lien \`.md\` et il s'affiche aussitôt avec soin. La table des matières suit la section que vous lisez.

### Raccourcis

| Touche | Action |
|---|---|
| Cmd/Ctrl + F | Rechercher dans le document |
| Cmd/Ctrl + M | Ouvrir la carte mentale |
| Cmd/Ctrl + S | Enregistrer |

---

## Modifier

Passez en mode Modifier pour écrire directement ; les marques Markdown se masquent quand le curseur s'éloigne.

### Astuces

- Collez ou glissez des images dans le document.
- Les tableaux se modifient cellule par cellule.
- En mode Modifier, appuyez sur le bouton Couper la diapo ici de la barre de mise en forme pour insérer un saut de diapositive.

---

## Code

Les blocs de code sont colorés et ont un bouton de copie.

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

---

## Notes

> [!TIP]
> Les alertes servent à mettre une remarque en évidence dans le document.

---

## Formules

Les formules mathématiques s'écrivent avec KaTeX :

$$
E = mc^2
$$

---

## Diagrammes

\`\`\`mermaid
flowchart LR
  A[Write] --> B[Read]
  B --> C[Share]
\`\`\`

---

## Présenter

Appuyez sur Présenter pour transformer le document en diaporama, ouvrez la carte mentale pour voir sa structure, ou exportez en PDF pour l'envoyer.

<!-- note: Ceci est une note de l'orateur, visible uniquement dans la vue orateur. -->
`;
