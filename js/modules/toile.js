/**
 * La toile d'araignée : la forme d'un candidat, à côté de ses chiffres.
 *
 * Trois règles, qui sont celles de la note du 13 septembre :
 *
 * - **des axes de même sens**, tous sur 0-100, tous « plus haut = mieux ». Le
 *   serveur les rend ainsi ; ce module ne les retourne pas ;
 * - **les axes sont les grandeurs du score**, aucune inventée pour remplir ;
 * - **elle reste à côté des chiffres**, jamais à leur place. Elle se dessine
 *   en SVG, sans bibliothèque : le produit s'installe sur un serveur sans
 *   accès.
 *
 * La forme moyenne de ce que le workspace valide est dessinée en pointillé
 * sous celle du candidat : c'est l'écart entre les deux qui se lit.
 */
const Toile = {
    //: Géométrie du dessin, en unités de la boîte `viewBox` : le centre et le
    //  rayon de l'axe à 100. La taille affichée vient de la feuille de style.
    CENTRE: 50,
    RAYON: 42,

    coordonnees(rang, total, valeur) {
        const angle = -Math.PI / 2 + (2 * Math.PI * rang) / total;
        const r = (Toile.RAYON * Math.max(0, Math.min(100, Number(valeur) || 0))) / 100;
        // Des coordonnées, pas un nombre affiché : arrondies au centième, et
        // toujours écrites avec un point, quelle que soit la langue.
        const arrondir = (valeur) => Math.round(valeur * 100) / 100;
        return [arrondir(Toile.CENTRE + r * Math.cos(angle)),
                arrondir(Toile.CENTRE + r * Math.sin(angle))];
    },

    polygone(axes, valeurs) {
        return axes.map((axe, rang) => Toile.coordonnees(rang, axes.length, valeurs[axe]).join(','))
            .join(' ');
    },

    /** La phrase qui dit la même chose que le dessin, pour qui ne le voit pas. */
    description(axes, candidat, reference) {
        return axes.map((axe) => I18n.t('apprentissage.toile.axe', {
            axe: I18n.t(`apprentissage.toile.${axe}`),
            valeur: Utils.formatNumber(candidat[axe]),
            reference: reference ? Utils.formatNumber(reference[axe]) : '—',
        })).join(' · ');
    },

    svg(axes, candidat, reference) {
        const description = Utils.escapeHtml(Toile.description(axes, candidat, reference));
        const rayons = axes.map((_, rang) => {
            const [x, y] = Toile.coordonnees(rang, axes.length, 100);
            return `<line class="toile__axe" x1="${Toile.CENTRE}" y1="${Toile.CENTRE}"
                x2="${x}" y2="${y}"></line>`;
        }).join('');
        const plein = Object.fromEntries(axes.map((axe) => [axe, 100]));
        return `<svg class="toile" viewBox="0 0 100 100" role="img" aria-label="${description}">
                <title>${description}</title>
                <polygon class="toile__cadre" points="${Toile.polygone(axes, plein)}"></polygon>
                ${rayons}
                ${reference ? `<polygon class="toile__reference" points="${
                    Toile.polygone(axes, reference)}"></polygon>` : ''}
                <polygon class="toile__candidat" points="${Toile.polygone(axes, candidat)}"></polygon>
            </svg>`;
    },
};

window.Toile = Toile;
