/**
 * PyGIA Frontend - Settings Page
 */

const SettingsPage = {
    //: Référentiels sur lesquels une politique de qualité des clés peut être
    //  surchargée. Même liste que côté serveur, et un test le vérifie : un
    //  nom qui ne s'y trouve pas est refusé à l'enregistrement.
    REFERENTIELS: ['identities', 'applications', 'rights', 'habs'],

    //: Opérations de transformation, et celles qui exigent une valeur. Même
    //  partage que côté serveur : une valeur saisie sur une opération qui n'en
    //  prend pas serait refusée à l'enregistrement.
    OPERATIONS: ['trim', 'upper', 'lower', 'strip_prefix', 'add_prefix', 'split',
                 'recode'],
    OPERATIONS_AVEC_VALEUR: ['strip_prefix', 'add_prefix', 'split'],
    //: Opérations dont la valeur est une table, et non une chaîne. Elles se
    //  voient ici — l'ordre des règles est le sens même du mécanisme — mais ne
    //  s'y saisissent pas : une table de recodage s'écrit dans l'écran de
    //  cohérence des valeurs, qui la construit à partir des données.
    OPERATIONS_AVEC_TABLE: ['recode'],

    //: Règles de transformation en cours d'édition, dans l'ordre d'application.
    regles: [],

    //: Sens qu'une règle de périmètre peut prendre, et sort réservé aux
    //  identités dont l'attribut est vide. Mêmes valeurs que côté serveur.
    SENS: ['keep', 'discard'],

    //: Règles de périmètre en cours d'édition, valeurs observées par colonne
    //  d'identité, et effet du jeu courant sur le référentiel chargé.
    perimetre: [],
    attributsPerimetre: {},
    rapportPerimetre: null,
    //: Borne au-delà de laquelle une colonne n'est plus un critère mais un
    //  identifiant. Elle vient du serveur avec la liste des colonnes : la
    //  réécrire ici la ferait diverger le jour où elle change.
    valeursMax: null,

    //: Identités écartées nominativement, telles que le serveur les rend.
    exclusions: [],

    //: La matrice usage × matière, telle que le serveur la rend, et telle que
    //  l'écran la modifie avant enregistrement. Les usages déclarés viennent
    //  du serveur : les réécrire ici les ferait diverger le jour où l'un
    //  s'ajoute.
    assistance: null,

    //: Colonnes que le serveur juge analysables, pour les usages qui se
    //  délimitent par colonne. Aucune n'est écrite ici.
    colonnesOuvrables: [],

    //: Dernière configuration lue. D'autres écrans s'en servent — le mining y
    //  trouve la liste des droits que le client considère comme sensibles.
    config: null,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Le moteur de modèle : les boutons n'existent que là où l'exécution
        // peut accepter une déclaration. Ailleurs, la carte reste masquée et
        // ces deux recherches ne trouvent rien.
        const declarer = document.getElementById('modele-declarer');
        if (declarer) {
            declarer.addEventListener('click', () => this.declarerLeModele());
        }
        const oublier = document.getElementById('modele-oublier');
        if (oublier) {
            oublier.addEventListener('click', () => this.oublierLeModele());
        }

        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        const resetBtn = document.getElementById('reset-settings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.loadSettings());
        }

        const ajout = document.getElementById('add-transformation');
        if (ajout) {
            ajout.addEventListener('click', () => this.ajouterRegle());
        }

        // Délégation : la liste des règles est reconstruite à chaque
        // modification, un écouteur posé sur chaque bouton serait perdu.
        const liste = document.getElementById('transformation-rules');
        if (liste) {
            liste.addEventListener('click', (evenement) => {
                const bouton = evenement.target.closest('[data-tf-action]');
                if (!bouton) return;
                evenement.preventDefault();
                this.agirSurRegle(bouton.dataset.tfAction,
                                  Number(bouton.dataset.tfIndex));
            });
            liste.addEventListener('change', (evenement) => {
                const champ = evenement.target.closest('[data-tf-champ]');
                if (!champ) return;
                this.modifierRegle(Number(champ.dataset.tfIndex),
                                   champ.dataset.tfChamp, champ.value);
            });
            liste.addEventListener('input', (evenement) => {
                const champ = evenement.target.closest('[data-tf-champ]');
                if (!champ || champ.tagName === 'SELECT') return;
                this.modifierRegle(Number(champ.dataset.tfIndex),
                                   champ.dataset.tfChamp, champ.value, false);
            });
        }

        const ajoutPerimetre = document.getElementById('add-perimeter-rule');
        if (ajoutPerimetre) {
            ajoutPerimetre.addEventListener('click', () => this.ajouterReglePerimetre());
        }

        // Délégation : la liste est reconstruite après chaque réintégration.
        const exclusions = document.getElementById('perimeter-excluded');
        if (exclusions) {
            exclusions.addEventListener('click', (evenement) => {
                const bouton = evenement.target.closest('[data-reintegrer]');
                if (!bouton) return;
                evenement.preventDefault();
                this.reintegrer(bouton.dataset.reintegrer);
            });
        }

        const perimetre = document.getElementById('perimeter-rules');
        if (perimetre) {
            perimetre.addEventListener('click', (evenement) => {
                const bouton = evenement.target.closest('[data-pe-action]');
                if (!bouton) return;
                evenement.preventDefault();
                this.perimetre.splice(Number(bouton.dataset.peIndex), 1);
                this.renderPerimetre();
            });
            perimetre.addEventListener('change', (evenement) => {
                const champ = evenement.target.closest('[data-pe-champ]');
                if (!champ) return;
                this.modifierReglePerimetre(Number(champ.dataset.peIndex),
                                            champ.dataset.peChamp, champ);
            });
        }

        // Délégation aussi : les blocs d'assistance sont redessinés à chaque
        // case cochée, puisque fermer un usage grise ses matières.
        const proposer = document.getElementById('cfg-sensitive-rights-suggest');
        if (proposer) {
            proposer.addEventListener('click', () => this.proposerLesDroitsSensibles());
        }

        // Délégation : le panneau est réécrit à chaque proposition.
        const propositions = document.getElementById('cfg-sensitive-rights-proposal');
        if (propositions) {
            propositions.addEventListener('click', (evenement) => {
                if (evenement.target.closest('#cfg-sensitive-rights-apply')) {
                    evenement.preventDefault();
                    this.appliquerLesFragments();
                }
            });
        }

        const essaiNommage = document.getElementById('cfg-naming-essai');
        if (essaiNommage) {
            essaiNommage.addEventListener('click', () => this.essayerLeDecoupage());
        }

        const proposerPrivileges = document.getElementById('cfg-privileged-suggest');
        if (proposerPrivileges) {
            proposerPrivileges.addEventListener(
                'click', () => this.proposerLesComptesAPrivileges());
        }

        const propositionsPrivileges = document.getElementById('cfg-privileged-proposal');
        if (propositionsPrivileges) {
            propositionsPrivileges.addEventListener('click', (evenement) => {
                if (evenement.target.closest('#cfg-privileged-apply')) {
                    evenement.preventDefault();
                    this.appliquerLesComptesAPrivileges();
                }
            });
        }

        const assistance = document.getElementById('assistance-usages');
        if (assistance) {
            assistance.addEventListener('change', (evenement) => {
                const cible = evenement.target;
                if (cible.dataset.assistanceActif) {
                    this.modifierAssistance(cible.dataset.assistanceActif, null,
                                            cible.checked);
                } else if (cible.dataset.assistanceUsage) {
                    this.modifierAssistance(cible.dataset.assistanceUsage,
                                            cible.dataset.assistanceMatiere,
                                            cible.checked);
                } else if (cible.dataset.assistanceColonne) {
                    this.modifierLaColonne(cible.dataset.assistanceColonne,
                                           cible.dataset.assistanceReferentiel,
                                           cible.dataset.assistanceNom,
                                           cible.checked);
                }
            });
        }
    },

    /**
     * Ajoute une règle de périmètre sur la première colonne exploitable.
     *
     * Il n'y a pas de colonne par défaut à écrire dans le code : le produit ne
     * connaît pas les colonnes du client. On prend la première que le serveur
     * propose, et l'utilisateur choisit.
     */
    ajouterReglePerimetre() {
        const colonnes = Object.keys(this.attributsPerimetre);
        if (colonnes.length === 0) {
            Toast.warning(I18n.t('common.warning'),
                          I18n.t('perimeter.no_attribute', { max: this.valeursMax }));
            return;
        }
        this.perimetre.push({ attribut: colonnes[0], sens: 'keep', valeurs: [],
                              sans_valeur: 'discard' });
        this.renderPerimetre();
    },

    modifierReglePerimetre(index, champ, element) {
        const regle = this.perimetre[index];
        if (!regle) return;
        if (champ === 'valeurs') {
            regle.valeurs = Array.from(element.selectedOptions).map((o) => o.value);
        } else {
            regle[champ] = element.value;
            // Les valeurs proposées appartiennent à la colonne : en changer
            // rendrait la sélection précédente absurde.
            if (champ === 'attribut') regle.valeurs = [];
        }
        this.renderPerimetre();
    },

    renderPerimetre() {
        const conteneur = document.getElementById('perimeter-rules');
        if (!conteneur) return;

        const colonnes = Object.keys(this.attributsPerimetre);
        if (colonnes.length === 0) {
            conteneur.innerHTML = `<p class="form-hint">${Utils.escapeHtml(
                I18n.t('perimeter.no_attribute', { max: this.valeursMax }))}</p>`;
        } else if (this.perimetre.length === 0) {
            conteneur.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('perimeter.empty'))}</p>`;
        } else {
            conteneur.innerHTML = this.perimetre.map(
                (regle, index) => this.ligneReglePerimetre(regle, index, colonnes)).join('');
        }
        this.renderRapportPerimetre();
    },

    ligneReglePerimetre(regle, index, colonnes) {
        const options = (valeurs, choisies, libelle) => valeurs.map(
            (valeur) => `<option value="${Utils.escapeHtml(valeur)}"${
                choisies.indexOf(valeur) !== -1 ? ' selected' : ''}>${
                Utils.escapeHtml(libelle(valeur))}</option>`).join('');

        const valeurs = this.attributsPerimetre[regle.attribut] || [];
        return `
            <div class="transformation-rule" data-pe-rule="${index}">
                <select class="form-input" data-pe-champ="attribut" data-pe-index="${index}"
                        aria-label="${Utils.escapeHtml(I18n.t('perimeter.rule.attribute'))}">
                    ${options(colonnes, [regle.attribut], (v) => v)}
                </select>
                <select class="form-input" data-pe-champ="sens" data-pe-index="${index}"
                        aria-label="${Utils.escapeHtml(I18n.t('perimeter.rule.direction'))}">
                    ${options(this.SENS, [regle.sens],
                              (v) => I18n.t(`perimeter.direction.${v}`))}
                </select>
                <select class="form-input" multiple size="4" data-pe-champ="valeurs"
                        data-pe-index="${index}"
                        aria-label="${Utils.escapeHtml(I18n.t('perimeter.rule.values'))}">
                    ${options(valeurs, regle.valeurs, (v) => v)}
                </select>
                <select class="form-input" data-pe-champ="sans_valeur" data-pe-index="${index}"
                        data-definition="definition.perimeter.missing"
                        aria-label="${Utils.escapeHtml(I18n.t('perimeter.rule.missing'))}">
                    ${options(this.SENS, [regle.sans_valeur],
                              (v) => I18n.t(`perimeter.missing.${v}`))}
                </select>
                <button type="button" class="btn-link btn-sm" data-pe-action="remove"
                        data-pe-index="${index}"
                        aria-label="${Utils.escapeHtml(I18n.t('perimeter.remove_rule'))}">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
            </div>`;
    },

    /**
     * Sur quelle population portent les chiffres du produit.
     *
     * Écarter des identités change le dénominateur de la couverture, du
     * sur-octroi et des effectifs. Un écran qui pose un filtre sans dire
     * combien d'identités il retire remplace une demi-vérité par une autre,
     * en pire, parce que celle-ci est invisible.
     */
    renderRapportPerimetre() {
        const cible = document.getElementById('perimeter-scope');
        if (!cible) return;
        const rapport = this.rapportPerimetre;
        if (!rapport) {
            cible.textContent = '';
            return;
        }

        const phrases = [I18n.t('perimeter.scope', {
            scope: Utils.formatNumber(rapport.identities_in_scope),
            total: Utils.formatNumber(rapport.identities_total),
        })];
        if (rapport.excluded_total) {
            phrases.push(I18n.t('perimeter.excluded_detail', {
                rules: Utils.formatNumber(rapport.excluded_by_rules),
                named: Utils.formatNumber(rapport.excluded_by_name),
            }));
        }
        // Une règle sans effet doit se voir : sinon l'utilisateur croit son
        // périmètre restreint alors qu'il ne l'est pas.
        if ((rapport.inapplicable_rules || []).length) {
            phrases.push(I18n.t('perimeter.inapplicable', {
                attributes: rapport.inapplicable_rules.join(', '),
            }));
        }
        cible.textContent = phrases.join(' ');
    },

    async enregistrerPerimetre() {
        try {
            const reponse = await API.setPerimeterRules(this.perimetre);
            this.rapportPerimetre = reponse.perimeter || null;
            this.renderRapportPerimetre();
        } catch (erreur) {
            Toast.error(I18n.t('common.error'), I18n.t('perimeter.save_failed'));
        }
    },

    /**
     * Réintègre une identité au périmètre.
     *
     * Une décision de gouvernance qu'on ne peut pas défaire n'en est pas une :
     * elle devient un état subi. Le retour est tracé comme l'exclusion.
     */
    async reintegrer(identifiant) {
        try {
            await API.restoreUser(identifiant);
            Toast.success(I18n.t('common.success'),
                          I18n.t('perimeter.excluded.restored'));
            await this.chargerExclusions();
            await this.chargerPerimetre();
        } catch (erreur) {
            Toast.error(I18n.t('common.error'),
                        I18n.t('perimeter.excluded.restore_failed'));
        }
    },

    async chargerExclusions() {
        try {
            const reponse = await API.getExcludedUsers();
            this.exclusions = reponse.excluded_users || [];
        } catch (erreur) {
            this.exclusions = [];
        }
        this.renderExclusions();
    },

    renderExclusions() {
        const conteneur = document.getElementById('perimeter-excluded');
        if (!conteneur) return;

        if (this.exclusions.length === 0) {
            conteneur.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('perimeter.excluded.empty'))}</p>`;
            return;
        }

        const lignes = this.exclusions.map((identifiant) => `
            <div class="transformation-rule">
                <span>${Utils.escapeHtml(String(identifiant))}</span>
                <button type="button" class="btn-link btn-sm"
                        data-reintegrer="${Utils.escapeHtml(String(identifiant))}">
                    ${Utils.escapeHtml(I18n.t('perimeter.excluded.restore'))}
                </button>
            </div>`).join('');

        conteneur.innerHTML = `<p class="form-hint">${Utils.escapeHtml(
            I18n.t('perimeter.excluded.count', {
                count: Utils.formatNumber(this.exclusions.length),
            }))}</p>${lignes}`;
    },

    async chargerPerimetre() {
        try {
            const reponse = await API.getPerimeterRules();
            this.perimetre = (reponse.rules || []).map((regle) => ({
                attribut: regle.attribut, sens: regle.sens,
                valeurs: (regle.valeurs || []).slice(),
                sans_valeur: regle.sans_valeur,
            }));
            this.attributsPerimetre = reponse.attributes || {};
            this.rapportPerimetre = reponse.perimeter || null;
            this.valeursMax = reponse.values_max;
        } catch (erreur) {
            this.perimetre = [];
            this.attributsPerimetre = {};
            this.rapportPerimetre = null;
        }
        this.renderPerimetre();
    },

    /**
     * Ce que le produit a le droit de demander à un modèle, usage par usage.
     *
     * Un échec de lecture n'empêche pas le reste de l'écran de servir, mais il
     * ne se tait pas : une section vide se lirait comme « rien n'est ouvert »,
     * ce qui n'est pas la même chose que « je n'ai pas pu lire ».
     */
    async chargerAssistance() {
        try {
            this.assistance = await API.getAssistance();
        } catch (erreur) {
            this.assistance = null;
        }
        // Les colonnes du client, pour les usages qui se délimitent ainsi.
        // Aucune n'est écrite ici : elles viennent des fichiers chargés, et le
        // produit n'en présume aucune. Leur absence n'empêche pas le reste de
        // l'écran de servir — elle se dit.
        try {
            const rendu = await API.get('/coherence/colonnes');
            this.colonnesOuvrables = rendu.colonnes || [];
        } catch (erreur) {
            this.colonnesOuvrables = [];
        }
        this.renderAssistance();
    },

    renderAssistance() {
        const conteneur = document.getElementById('assistance-usages');
        if (!conteneur) return;

        if (!this.assistance) {
            conteneur.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('assistance.unreadable'))}</p>`;
            this.renderAvertissementsAssistance([]);
            return;
        }

        conteneur.innerHTML = (this.assistance.usages || [])
            .map((usage) => this.blocUsage(usage)).join('');
        this.renderAvertissementsAssistance(this.assistance.avertissements || []);
    },

    /**
     * Un usage : son interrupteur, sa matière, et son point de terminaison.
     *
     * L'ordre compte. L'interrupteur d'abord, parce que c'est la décision ;
     * la matière ensuite, parce qu'elle n'a de sens que si l'usage est ouvert ;
     * le trajet en dernier, parce qu'il relève de l'infrastructure et que
     * l'administrateur applicatif ne peut que le constater.
     */
    blocUsage(usage) {
        const point = usage.point_de_terminaison || {};
        const cases = (usage.declarees || []).map((declaree) => {
            const cochee = (usage.matiere || []).indexOf(declaree.matiere) !== -1;
            const id = `assistance-${usage.code}-${declaree.matiere}`;
            return `
                <label class="chart-option" for="${Utils.escapeHtml(id)}">
                    <input type="checkbox" id="${Utils.escapeHtml(id)}"
                           data-assistance-usage="${Utils.escapeHtml(usage.code)}"
                           data-assistance-matiere="${Utils.escapeHtml(declaree.matiere)}"
                           ${cochee ? 'checked' : ''}${usage.actif ? '' : ' disabled'}>
                    <span>${Utils.escapeHtml(
                        I18n.t(`assistance.matiere.${declaree.matiere}`))}</span>
                    <span class="form-hint">${Utils.escapeHtml(
                        I18n.t(`assistance.exigence.${declaree.exigence}`))}</span>
                </label>`;
        }).join('');

        return `
            <div class="file-config" data-assistance-bloc="${Utils.escapeHtml(usage.code)}">
                <h3 class="file-config-title">
                    <i class="fas fa-diagram-project" aria-hidden="true"></i>
                    <span>${Utils.escapeHtml(I18n.t(`assistance.usage.${usage.code}`))}</span>
                </h3>
                <p class="form-hint">${Utils.escapeHtml(
                    I18n.t(`assistance.usage.${usage.code}.hint`))}</p>
                <label class="chart-option" for="assistance-actif-${Utils.escapeHtml(usage.code)}">
                    <input type="checkbox" id="assistance-actif-${Utils.escapeHtml(usage.code)}"
                           data-assistance-actif="${Utils.escapeHtml(usage.code)}"
                           ${usage.actif ? 'checked' : ''}>
                    <span>${Utils.escapeHtml(I18n.t('assistance.usage_active'))}</span>
                </label>
                <div class="attribute-checkboxes">${cases}</div>
                ${this.blocDesColonnes(usage)}
                ${this.messageUsage(usage, point)}
            </div>`;
    },

    /**
     * Les colonnes dont les valeurs peuvent sortir, pour l'usage qui s'y
     * délimite.
     *
     * Sans cet écran, l'autorisation ne pouvait se donner qu'en éditant le
     * `config.json` à la main : la fonction était livrée et inatteignable. Un
     * réglage que seul un fichier permet d'écrire n'est pas un réglage.
     *
     * Les colonnes viennent du serveur, qui les tire des fichiers du client.
     * Référentiels non chargés, la liste est vide et le dit — c'est un état
     * normal sur un espace de travail neuf, pas une panne.
     */
    blocDesColonnes(usage) {
        if (!usage.par_colonne) return '';
        const disponibles = this.colonnesOuvrables || [];
        if (disponibles.length === 0) {
            return `<p class="form-hint">${Utils.escapeHtml(
                I18n.t('assistance.columns_unavailable'))}</p>`;
        }
        const ouvertes = new Set((usage.colonnes || []).map(
            (colonne) => `${colonne.referentiel}\u0000${colonne.colonne}`));
        const cases = disponibles.map((colonne) => {
            const cle = `${colonne.referentiel}\u0000${colonne.colonne}`;
            const id = `assistance-col-${usage.code}-${colonne.referentiel}-${colonne.colonne}`;
            return `
                <label class="chart-option" for="${Utils.escapeHtml(id)}">
                    <input type="checkbox" id="${Utils.escapeHtml(id)}"
                           data-assistance-colonne="${Utils.escapeHtml(usage.code)}"
                           data-assistance-referentiel="${Utils.escapeHtml(colonne.referentiel)}"
                           data-assistance-nom="${Utils.escapeHtml(colonne.colonne)}"
                           ${ouvertes.has(cle) ? 'checked' : ''}${usage.actif ? '' : ' disabled'}>
                    <span>${Utils.escapeHtml(
                        `${I18n.t(`quality.referential.${colonne.referentiel}`)} — ${colonne.colonne}`)}</span>
                </label>`;
        }).join('');
        // Une colonne ouverte et rien d'autre : l'usage ne peut rien demander,
        // même actif. `posable` ne le dit pas — il parle de la matière.
        const vide = (usage.colonnes || []).length === 0
            ? `<p class="form-hint">${Utils.escapeHtml(
                I18n.t('assistance.columns_none'))}</p>` : '';
        return `
            <fieldset class="file-config__colonnes">
                <legend class="form-label">${Utils.escapeHtml(
                    I18n.t('assistance.columns_title'))}</legend>
                <p class="form-hint">${Utils.escapeHtml(
                    I18n.t('assistance.columns_hint'))}</p>
                <div class="attribute-checkboxes">${cases}</div>
                ${vide}
            </fieldset>`;
    },

    /**
     * Ce qui manque, et où part la demande.
     *
     * Un usage ouvert qui ne peut rien donner doit le dire ici, et nommer ce
     * qu'il faudrait ouvrir. Sans cette phrase, l'administrateur croit avoir
     * configuré et c'est l'utilisateur qui découvre le refus.
     */
    messageUsage(usage, point) {
        const lignes = [];
        if (!point.actif) {
            lignes.push(`<div class="form-hint">${
                Utils.escapeHtml(I18n.t('assistance.no_endpoint'))}</div>`);
        } else {
            const cle = point.locale ? 'assistance.stays_local' : 'assistance.leaves_machine';
            const classe = point.locale ? 'form-hint' : 'alert alert-warning';
            lignes.push(`<div class="${classe}">${Utils.escapeHtml(
                I18n.t(cle, { hote: point.hote, modele: point.modele }))}</div>`);
            if (point.propre) {
                lignes.push(`<div class="form-hint">${
                    Utils.escapeHtml(I18n.t('assistance.own_endpoint'))}</div>`);
            }
        }
        if (usage.actif && (usage.manque || []).length > 0) {
            const manque = usage.manque.map(
                (matiere) => I18n.t(`assistance.matiere.${matiere}`)).join(', ');
            lignes.push(`<div class="alert alert-warning">${Utils.escapeHtml(
                I18n.t('assistance.missing_matter', { matieres: manque }))}</div>`);
        }
        return lignes.join('');
    },

    /**
     * Ce que le serveur a écarté en lisant la configuration.
     *
     * Une configuration écrite pour une version plus récente ne doit ni ouvrir
     * une porte que cette version ignore, ni disparaître en silence.
     */
    renderAvertissementsAssistance(avertissements) {
        const cible = document.getElementById('assistance-warnings');
        if (!cible) return;
        cible.innerHTML = avertissements.map((avertissement) =>
            `<div class="alert alert-warning">${Utils.escapeHtml(
                I18n.t(avertissement.code, avertissement.params || {}))}</div>`).join('');
    },

    /**
     * Applique une case à l'état, puis redessine.
     *
     * Fermer un usage décoche ses matières à l'affichage, mais ne les efface
     * pas de l'état : rouvrir l'usage sans avoir à tout recocher est ce que
     * l'administrateur attend, et l'enregistrement, lui, n'écrit la matière
     * que d'un usage ouvert.
     */
    modifierAssistance(code, matiere, coche) {
        if (!this.assistance) return;
        const usage = (this.assistance.usages || []).find((u) => u.code === code);
        if (!usage) return;
        if (matiere === null) {
            usage.actif = coche;
        } else {
            const retenues = new Set(usage.matiere || []);
            if (coche) { retenues.add(matiere); } else { retenues.delete(matiere); }
            usage.matiere = (this.assistance.matieres || [])
                .filter((connue) => retenues.has(connue));
        }
        usage.manque = this.manqueDe(usage);
        this.renderAssistance();
    },

    /**
     * Ce qui manque à un usage, recalculé côté écran pour que la phrase suive
     * la case qu'on vient de décocher sans attendre l'enregistrement.
     *
     * Le serveur reste seul juge : il refait ce calcul à la lecture, et c'est
     * sa réponse qui s'affiche au rechargement.
     */
    /**
     * Ouvre ou ferme une colonne pour un usage.
     *
     * Comme pour la matière : fermer l'usage n'efface pas ses colonnes de
     * l'état — rouvrir sans tout recocher est ce que l'administrateur attend —
     * et l'enregistrement n'écrit celles d'un usage ouvert.
     */
    modifierLaColonne(code, referentiel, colonne, coche) {
        if (!this.assistance) return;
        const usage = (this.assistance.usages || []).find((u) => u.code === code);
        if (!usage) return;
        const retenues = (usage.colonnes || []).filter(
            (ouverte) => !(ouverte.referentiel === referentiel
                           && ouverte.colonne === colonne));
        if (coche) retenues.push({ referentiel, colonne });
        // Triées : le document se relit et se compare d'une version à l'autre,
        // et l'écran ne doit pas dépendre de l'ordre des clics.
        usage.colonnes = retenues.sort(
            (un, autre) => `${un.referentiel}${un.colonne}`.localeCompare(
                `${autre.referentiel}${autre.colonne}`));
        usage.portee_ouverte = usage.colonnes.length > 0;
        this.renderAssistance();
    },

    manqueDe(usage) {
        const ouvertes = new Set(usage.matiere || []);
        const declarees = usage.declarees || [];
        const necessaires = declarees
            .filter((d) => d.exigence === 'necessaire' && !ouvertes.has(d.matiere))
            .map((d) => d.matiere);
        const auMoinsUne = declarees
            .filter((d) => d.exigence === 'au_moins_une').map((d) => d.matiere);
        if (auMoinsUne.length > 0 && !auMoinsUne.some((m) => ouvertes.has(m))) {
            return necessaires.concat(auMoinsUne);
        }
        return necessaires;
    },

    /**
     * Enregistre la matrice. Même bouton que le reste de l'écran, route à part.
     *
     * Son échec ne doit ni faire échouer le reste, ni passer sous silence :
     * croire qu'on a fermé une sortie de données qui reste ouverte est
     * exactement ce que cet écran existe pour éviter.
     */
    async enregistrerAssistance() {
        if (!this.assistance) return;
        const usages = {};
        (this.assistance.usages || []).forEach((usage) => {
            usages[usage.code] = {
                actif: !!usage.actif,
                matiere: usage.actif ? (usage.matiere || []).slice() : [],
            };
            // Le champ n'existe que pour les usages qui s'y délimitent : le
            // serveur refuse une liste envoyée pour les autres, et il a raison
            // — elle ne restreindrait rien.
            if (usage.par_colonne) {
                usages[usage.code].colonnes = usage.actif
                    ? (usage.colonnes || []).slice() : [];
            }
        });
        try {
            this.assistance = await API.saveAssistance({ usages });
            this.renderAssistance();
        } catch (erreur) {
            Toast.error(I18n.t('common.error'),
                        erreur.message || I18n.t('assistance.save_failed'));
        }
    },


    /**
     * Demande les fragments qui signalent un droit sensible.
     *
     * Le réglage appartient au client — le produit ne peut pas décider qu'un
     * droit est sensible à sa place — et il reste vide chez la plupart, faute
     * de savoir quoi y mettre. Un réglage vide est une fonctionnalité morte.
     */
    async proposerLesDroitsSensibles() {
        const bouton = document.getElementById('cfg-sensitive-rights-suggest');
        if (!bouton) return;
        const libelle = bouton.innerHTML;
        bouton.disabled = true;
        bouton.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${
            Utils.escapeHtml(I18n.t('annotator.asking'))}`;
        try {
            const proposition = await API.proposerLesDroitsSensibles(I18n.currentLocale);
            this.fragmentsProposes = proposition.fragments || [];
            this.renderLesFragments();
        } catch (erreur) {
            Toast.error(I18n.t('common.error'),
                        erreur.message || I18n.t('annotator.unavailable'));
        } finally {
            bouton.disabled = false;
            bouton.innerHTML = libelle;
        }
    },

    //: Fragments proposés, en attente de relecture. Rien n'est enregistré tant
    //  que l'utilisateur n'a pas repris ceux qu'il retient.
    fragmentsProposes: [],

    /**
     * Les fragments proposés, avec ce que chacun signalerait.
     *
     * Le nombre de droits est **compté par le serveur** sur le référentiel
     * entier : le modèle propose des mots, il n'annonce aucun volume. Les
     * exemples sont là pour que la décision se prenne sur des cas et non sur
     * un chiffre.
     */
    renderLesFragments() {
        const zone = document.getElementById('cfg-sensitive-rights-proposal');
        if (!zone) return;
        if (this.fragmentsProposes.length === 0) {
            zone.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('sensitive.none'))}</p>`;
            return;
        }
        const lignes = this.fragmentsProposes.map((propose, index) => `
            <label class="chart-option" for="fragment-${index}">
                <input type="checkbox" id="fragment-${index}" checked
                       data-fragment="${Utils.escapeHtml(propose.fragment)}">
                <span><strong>${Utils.escapeHtml(propose.fragment)}</strong> —
                    ${Utils.escapeHtml(I18n.t('sensitive.count',
                                              { count: propose.droits }))}</span>
                <span class="form-hint">${Utils.escapeHtml(propose.motif || '')}
                    ${Utils.escapeHtml((propose.exemples || []).join(', '))}</span>
            </label>`).join('');
        zone.innerHTML = `
            <p class="form-hint">${Utils.escapeHtml(I18n.t('sensitive.review'))}</p>
            <div class="attribute-checkboxes">${lignes}</div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary btn-sm"
                        id="cfg-sensitive-rights-apply">
                    <i class="fas fa-arrow-up" aria-hidden="true"></i>
                    <span>${Utils.escapeHtml(I18n.t('sensitive.apply'))}</span>
                </button>
            </div>`;
    },

    /**
     * Reprend les fragments cochés dans le champ. C'est le seul moment où la
     * proposition agit — et elle ne s'enregistre qu'avec le reste de l'écran.
     */
    appliquerLesFragments() {
        const coches = Array.from(document.querySelectorAll(
            '#cfg-sensitive-rights-proposal input[data-fragment]:checked'))
            .map((element) => element.dataset.fragment);
        if (coches.length === 0) {
            Toast.error(I18n.t('common.error'), I18n.t('sensitive.nothing_kept'));
            return;
        }
        const existants = Utils.parseCSV(this.getFieldValue('cfg-sensitive-rights'));
        // Fusion et non remplacement : ce que l'utilisateur avait saisi vaut au
        // moins autant qu'une proposition, et l'effacer serait le punir d'avoir
        // demandé un avis.
        const retenus = [];
        existants.concat(coches).forEach((fragment) => {
            if (fragment && !retenus.some(
                (deja) => deja.toUpperCase() === fragment.toUpperCase())) {
                retenus.push(fragment);
            }
        });
        this.setFieldValue('cfg-sensitive-rights', retenus.join(', '));
        Toast.success(I18n.t('common.success'),
                      I18n.t('sensitive.applied', { count: coches.length }));
    },

    //: Conventions proposées, en attente de relecture. Comme pour les droits
    //  sensibles : rien n'est enregistré tant que rien n'est repris.
    conventionsProposees: [],

    /**
     * Demande les conventions de nommage des comptes à privilèges.
     *
     * C'est la seule demande du produit qui ne transmet **rien** : la question
     * porte sur ce que fait le métier, pas sur ce que contient ce référentiel.
     * Ce qui revient est du vocabulaire, éprouvé côté serveur sur les identités
     * chargées — une convention que ce client n'emploie pas est écartée avant
     * d'arriver ici.
     */
    async proposerLesComptesAPrivileges() {
        const bouton = document.getElementById('cfg-privileged-suggest');
        if (!bouton) return;
        const libelle = bouton.innerHTML;
        bouton.disabled = true;
        bouton.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${
            Utils.escapeHtml(I18n.t('annotator.asking'))}`;
        try {
            const proposition = await API.proposerLesComptesAPrivileges(
                I18n.currentLocale);
            this.conventionsProposees = proposition.fragments || [];
            this.renderLesConventions();
        } catch (erreur) {
            Toast.error(I18n.t('common.error'),
                        erreur.message || I18n.t('annotator.unavailable'));
        } finally {
            bouton.disabled = false;
            bouton.innerHTML = libelle;
        }
    },

    /**
     * Les conventions proposées, avec ce que chacune marquerait.
     *
     * Le nombre de comptes est **compté par le serveur**, à la place déclarée,
     * sur le référentiel entier. Les exemples sont des identifiants déjà
     * visibles dans l'écran des identités : la décision se prend sur des cas,
     * pas sur un chiffre — c'est là qu'on voit qu'un fragment marque des
     * comptes ordinaires.
     */
    renderLesConventions() {
        const zone = document.getElementById('cfg-privileged-proposal');
        if (!zone) return;
        if (this.conventionsProposees.length === 0) {
            zone.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('privileges.none'))}</p>`;
            return;
        }
        const lignes = this.conventionsProposees.map((propose, index) => `
            <label class="chart-option" for="convention-${index}">
                <input type="checkbox" id="convention-${index}" checked
                       data-convention="${Utils.escapeHtml(propose.fragment)}">
                <span><strong>${Utils.escapeHtml(propose.fragment)}</strong> —
                    ${Utils.escapeHtml(I18n.t('privileges.fragment_count',
                                              { comptes: propose.comptes }))}</span>
                <span class="form-hint">${Utils.escapeHtml(propose.motif || '')}
                    ${Utils.escapeHtml((propose.exemples || []).join(', '))}</span>
            </label>`).join('');
        zone.innerHTML = `
            <p class="form-hint">${Utils.escapeHtml(I18n.t('privileges.review'))}</p>
            <div class="attribute-checkboxes">${lignes}</div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary btn-sm"
                        id="cfg-privileged-apply">
                    <i class="fas fa-arrow-up" aria-hidden="true"></i>
                    <span>${Utils.escapeHtml(I18n.t('privileges.apply'))}</span>
                </button>
            </div>`;
    },

    /**
     * Reprend les conventions cochées dans le champ. Fusion et non
     * remplacement, pour la même raison que les droits sensibles : ce que
     * l'utilisateur avait saisi vaut au moins autant qu'une proposition.
     */
    appliquerLesComptesAPrivileges() {
        const coches = Array.from(document.querySelectorAll(
            '#cfg-privileged-proposal input[data-convention]:checked'))
            .map((element) => element.dataset.convention);
        if (coches.length === 0) {
            Toast.error(I18n.t('common.error'), I18n.t('privileges.nothing_kept'));
            return;
        }
        const existants = Utils.parseCSV(this.getFieldValue('cfg-privileged-keywords'));
        const retenus = [];
        existants.concat(coches).forEach((fragment) => {
            if (fragment && !retenus.some(
                (deja) => deja.toUpperCase() === fragment.toUpperCase())) {
                retenus.push(fragment);
            }
        });
        this.setFieldValue('cfg-privileged-keywords', retenus.join(', '));
        Toast.success(I18n.t('common.success'),
                      I18n.t('privileges.applied', { count: coches.length }));
    },

    /**
     * Ce que la déclaration enregistrée marque aujourd'hui.
     *
     * Un échec n'affiche rien plutôt qu'un zéro : « aucun compte marqué » est
     * une information, et l'écrire alors qu'on n'a pas pu compter serait le
     * seul mensonge que cet écran puisse produire.
     */
    async chargerLeDenombrementDesPrivileges() {
        const zone = document.getElementById('cfg-privileged-denombrement');
        if (!zone) return;
        try {
            this.denombrementDesPrivileges =
                await API.getDenombrementDesPrivileges();
        } catch (erreur) {
            zone.innerHTML = '';
            return;
        }
        this.renderLeDenombrementDesPrivileges();
    },

    //: Dernier dénombrement rendu par le serveur.
    denombrementDesPrivileges: null,

    /**
     * Rend le dénombrement, et distingue les trois façons de ne rien marquer.
     *
     * Rien n'est déclaré, la colonne déclarée est absente du fichier, ou la
     * déclaration ne correspond à aucun compte : ce sont trois situations, et
     * une seule phrase pour les trois enverrait l'utilisateur refaire sa liste
     * alors que c'est son export qui a changé.
     */
    renderLeDenombrementDesPrivileges() {
        const zone = document.getElementById('cfg-privileged-denombrement');
        const resume = this.denombrementDesPrivileges;
        if (!zone || !resume) return;
        if (resume.invalide) {
            zone.innerHTML = `<p class="form-hint form-hint-error">${
                Utils.escapeHtml(I18n.t('privileges.invalid', {
                    field: resume.invalide.field,
                    value: resume.invalide.value,
                    expected: (resume.invalide.expected || []).join(', '),
                }))}</p>`;
            return;
        }
        if (!resume.declare) {
            zone.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('privileges.undeclared'))}</p>`;
            return;
        }
        if (resume.colonne_absente) {
            zone.innerHTML = `<p class="form-hint form-hint-error">${
                Utils.escapeHtml(I18n.t('privileges.column_missing'))}</p>`;
            return;
        }
        if (!resume.marques) {
            zone.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('privileges.nothing_marked'))}</p>`;
            return;
        }
        const lignes = (resume.fragments || []).map((compte) => `
            <li><strong>${Utils.escapeHtml(compte.fragment)}</strong> —
                ${Utils.escapeHtml(I18n.t('privileges.fragment_count',
                                          { comptes: compte.marques }))}</li>`).join('');
        zone.innerHTML = `
            <p class="form-hint"><strong>${Utils.escapeHtml(I18n.t('privileges.count', {
                marques: Utils.formatNumber(resume.marques),
                population: Utils.formatNumber(resume.population),
            }))}</strong></p>
            <ul class="privileges-fragments">${lignes}</ul>
            <p class="form-hint">${Utils.escapeHtml(I18n.t('privileges.sample', {
                exemples: (resume.echantillon || []).slice(0, 5).join(', '),
            }))}</p>`;
    },

    // ------------------------------------------ la convention de nommage

    //: Dernier découpage rendu par le serveur.
    decoupage: null,
    //: Les rôles de position tels qu'ils sont **enregistrés**. Ils servent de
    //: repli quand l'écran n'a pas rendu de sélecteurs : la section peut
    //: n'avoir jamais été regardée, et un enregistrement effacerait alors une
    //: convention que personne n'a touchée.
    positionsDeclarees: [],

    /** Le découpage de la convention enregistrée, sur le référentiel chargé. */
    async chargerLeDecoupage() {
        const zone = document.getElementById('cfg-naming-decoupage');
        if (!zone) return;
        try {
            this.decoupage = await API.get('/nommage');
        } catch (erreur) {
            this.decoupage = null;
            zone.innerHTML = '';
            return;
        }
        this.renderLeDecoupage();
    },

    /**
     * Ce qu'une découpe donnerait, **sans rien déclarer**.
     *
     * C'est ce qui permet de déclarer une convention qu'on ne connaît pas par
     * cœur : on donne un séparateur et un nombre de positions, le produit
     * montre ce que chacune contient, et on nomme ensuite. Sans cela, il
     * faudrait enregistrer une déclaration fausse pour voir ce qu'elle produit.
     */
    async essayerLeDecoupage() {
        const zone = document.getElementById('cfg-naming-decoupage');
        if (!zone) return;
        const positions = parseInt(this.getFieldValue('cfg-naming-positions'), 10);
        if (!positions || positions < 1) {
            Toast.error(I18n.t('common.error'), I18n.t('nommage.positions_requises'));
            return;
        }
        try {
            this.decoupage = await API.get('/nommage', {
                positions,
                separateur: this.getFieldValue('cfg-naming-separator'),
                colonne: this.getFieldValue('cfg-naming-column'),
            });
        } catch (erreur) {
            Toast.error(I18n.t('common.error'), erreur.message);
            return;
        }
        this.renderLeDecoupage();
    },

    /**
     * Rend le découpage, et distingue les façons de ne rien dériver.
     *
     * Rien n'est déclaré, la déclaration est illisible, la colonne déclarée
     * est absente du fichier, ou un nom réservé entrerait en collision avec
     * une colonne du client : ce sont quatre situations, et une seule phrase
     * pour les quatre enverrait l'utilisateur refaire sa convention alors que
     * c'est son export qui a changé.
     */
    renderLeDecoupage() {
        const zone = document.getElementById('cfg-naming-decoupage');
        const resume = this.decoupage;
        if (!zone || !resume) return;
        if (resume.invalide) {
            zone.innerHTML = `<p class="form-hint form-hint-error">${
                Utils.escapeHtml(I18n.t('nommage.invalide', {
                    champ: resume.invalide.champ,
                    valeur: resume.invalide.valeur,
                    attendues: (resume.invalide.attendues || []).join(', '),
                }))}</p>`;
            return;
        }
        if (!resume.declaree && !resume.essai) {
            zone.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('nommage.non_declaree'))}</p>`;
            return;
        }
        if (resume.colonne_absente) {
            zone.innerHTML = `<p class="form-hint form-hint-error">${
                Utils.escapeHtml(I18n.t('nommage.colonne_absente'))}</p>`;
            return;
        }
        zone.innerHTML = this.renderLEtatDuDecoupage()
            + this.renderLesLongueurs()
            + this.renderLesPositions();
    },

    renderLEtatDuDecoupage() {
        const resume = this.decoupage;
        const lignes = [`<p class="form-hint"><strong>${
            Utils.escapeHtml(I18n.t('nommage.conformes', {
                conformes: Utils.formatNumber(resume.conformes),
                population: Utils.formatNumber(resume.population)}))}</strong></p>`];
        if ((resume.collisions || []).length) {
            // Les colonnes viennent des fichiers du client : écraser celle qui
            // porte par hasard un nom réservé ferait disparaître une donnée
            // qu'il a fournie.
            lignes.push(`<p class="form-hint form-hint-error">${
                Utils.escapeHtml(I18n.t('nommage.collision', {
                    colonnes: resume.collisions.join(', ')}))}</p>`);
        }
        if (resume.application_deduite) {
            lignes.push(`<p class="form-hint">${
                Utils.escapeHtml(I18n.t('nommage.application_deduite'))}</p>`);
        }
        return lignes.join('');
    },

    /**
     * La distribution des découpes.
     *
     * C'est elle qui dit si le référentiel a une convention du tout : trois
     * découpes majoritaires sur quatre mille droits se déclarent, douze
     * découpes équiprobables ne se déclarent pas.
     */
    renderLesLongueurs() {
        const longueurs = (this.decoupage.longueurs || []);
        if (!longueurs.length) return '';
        return `<ul class="nommage-longueurs">${longueurs.map((ligne) => `
            <li>${Utils.escapeHtml(I18n.t('nommage.longueur', {
                segments: ligne.segments,
                droits: Utils.formatNumber(ligne.droits)}))}</li>`).join('')}</ul>`;
    },

    /**
     * Une position, ce qu'elle contient, et le rôle qu'on lui donne.
     *
     * Les rôles viennent du serveur : la liste est fermée — le produit sait
     * quoi faire d'une application, il ne saurait rien faire d'un rôle que le
     * client aurait inventé — et une liste écrite en double dans l'écran
     * finirait par ne plus être la même.
     */
    renderLesPositions() {
        const resume = this.decoupage;
        const roles = resume.roles || [];
        return `<ul class="nommage-positions">${(resume.valeurs || []).map((position) => `
            <li class="nommage-position">
                <label class="form-label" for="cfg-naming-role-${position.position}">
                    ${Utils.escapeHtml(I18n.t('nommage.position', {
                        rang: position.position + 1,
                        distinctes: Utils.formatNumber(position.distinctes)}))}
                </label>
                <select class="form-input nommage-role"
                        id="cfg-naming-role-${position.position}"
                        data-position="${position.position}">
                    <option value=""${position.role ? '' : ' selected'}>${
                        Utils.escapeHtml(I18n.t('nommage.role.ignore'))}</option>
                    ${roles.map((role) => `
                        <option value="${Utils.escapeHtml(role)}"${
                            role === position.role ? ' selected' : ''}>${
                            Utils.escapeHtml(I18n.t(`nommage.role.${role}`))}</option>`).join('')}
                </select>
                <p class="form-hint">${Utils.escapeHtml(
                    (position.valeurs || []).slice(0, 8).map(
                        (valeur) => `${valeur.valeur} (${valeur.droits})`).join(', '))}</p>
            </li>`).join('')}</ul>`;
    },

    /**
     * Les rôles choisis position par position, ou ceux déjà enregistrés.
     *
     * Le repli n'est pas une politesse : la section peut n'avoir jamais été
     * regardée, et lire des sélecteurs absents rendrait une liste vide — ce
     * qui effacerait la convention au premier enregistrement fait depuis un
     * autre onglet de l'écran.
     */
    collectPositionsDeNommage() {
        const selecteurs = document.querySelectorAll('.nommage-role');
        if (!selecteurs.length) return this.positionsDeclarees.slice();
        return Array.from(selecteurs).map((selecteur) => selecteur.value);
    },

    /** Chargement en cours, s'il y en a un. */
    chargementEnCours: null,

    /**
     * La configuration seule, pour les écrans qui la lisent.
     *
     * Le démarrage chargeait **tout l'écran** des paramètres — règles de
     * périmètre, identités écartées, matrice d'assistance — alors qu'il n'a
     * besoin que de la configuration : d'autres écrans y lisent les fragments
     * de droits sensibles et les seuils. Ouvrir ensuite la page des paramètres
     * rejouait le tout : huit requêtes au lieu de quatre, et deux rendus
     * successifs de la liste des exclusions — le second remplaçait les boutons
     * du premier pendant qu'on cliquait dessus, et le clic partait dans le
     * vide sans que rien ne le signale.
     */
    async chargerLaConfiguration() {
        try {
            this.config = await API.getSettings();
        } catch (erreur) {
            // Silencieux : au démarrage, l'écran des paramètres n'est pas
            // affiché. Le signaler ferait apparaître une erreur sur le tableau
            // de bord pour un écran que personne n'a demandé — et la page des
            // paramètres, elle, le dira quand on l'ouvrira.
            this.config = this.config || {};
        }
        return this.config;
    },

    /**
     * Charge l'écran, une fois même si on le demande deux fois.
     *
     * Un rechargement demandé *après* la fin du précédent repart, lui :
     * revenir sur l'écran doit bien relire ce qu'un autre poste a pu changer.
     */
    /** L'exécution accepte-t-elle qu'on lui déclare un moteur de modèle ? */
    executionDeclarable() {
        return typeof window !== 'undefined' && Boolean(window.KovexModele);
    },

    /**
     * Le moteur de modèle, quand c'est la personne qui l'ouvre qui le déclare.
     *
     * Sur un poste, ces réglages viennent de l'environnement du serveur, et
     * cette carte reste masquée : un écran qui proposerait de les changer
     * mentirait sur qui décide. Dans une page autonome, il n'y a pas
     * d'environnement de serveur — l'infrastructure, c'est la personne devant
     * l'écran, et c'est ici qu'elle déclare.
     *
     * Ce que la déclaration change s'arrête là : la matrice d'assistance, les
     * catégories qui peuvent sortir et les attestations de la piste d'audit
     * sont celles du produit, et elles ne se déclarent pas ici.
     */
    async chargerLeModeleLocal() {
        const carte = document.getElementById('modele-local');
        if (!carte || !this.executionDeclarable()) return;
        carte.hidden = false;
        try {
            this.renderLEtatDuModele(await window.KovexModele.etat());
        } catch (erreur) {
            this.renderLEtatDuModele(null);
        }
    },

    /** Ce que le moteur porte : l'adresse, le modèle, et que la clé est posée. */
    renderLEtatDuModele(etat) {
        const ligne = document.getElementById('modele-etat');
        if (!ligne) return;
        if (!etat || !etat.adresse || !etat.modele) {
            ligne.textContent = I18n.t('modele.etat_aucun');
            return;
        }
        ligne.textContent = I18n.t(etat.cle_posee ? 'modele.etat_avec_cle'
                                                  : 'modele.etat_sans_cle',
                                   {modele: etat.modele, adresse: etat.adresse});
        const adresse = document.getElementById('modele-adresse');
        const nom = document.getElementById('modele-nom');
        if (adresse && !adresse.value) adresse.value = etat.adresse;
        if (nom && !nom.value) nom.value = etat.modele;
    },

    async declarerLeModele() {
        if (!this.executionDeclarable()) return;
        const adresse = (document.getElementById('modele-adresse').value || '').trim();
        const modele = (document.getElementById('modele-nom').value || '').trim();
        // Les deux ensemble ou rien : une adresse sans modèle ne désigne aucun
        // interlocuteur, et le produit considérerait l'assistance éteinte sans
        // dire pourquoi.
        if (!adresse || !modele) {
            Toast.error(I18n.t('common.error'), I18n.t('modele.adresse_requise'));
            return;
        }
        const conserver = document.getElementById('modele-conserver');
        const delai = (document.getElementById('modele-delai').value || '').trim();
        try {
            const etat = await window.KovexModele.declarer({
                adresse,
                modele,
                cle: document.getElementById('modele-cle').value || '',
                delai,
                conserver: conserver && conserver.checked ? 'onglet' : 'non',
            });
            // La clé n'est pas laissée dans le champ : elle est posée, l'état
            // le dit, et un champ rempli invite à la relire.
            document.getElementById('modele-cle').value = '';
            this.renderLEtatDuModele(etat);
            Toast.success(I18n.t('modele.declare'), I18n.t('modele.declare_detail'));
        } catch (erreur) {
            Toast.error(I18n.t('common.error'), erreur.message);
        }
    },

    async oublierLeModele() {
        if (!this.executionDeclarable()) return;
        try {
            const etat = await window.KovexModele.oublier();
            ['modele-adresse', 'modele-nom', 'modele-cle'].forEach((champ) => {
                const element = document.getElementById(champ);
                if (element) element.value = '';
            });
            this.renderLEtatDuModele(etat);
            Toast.success(I18n.t('modele.oublie'), I18n.t('modele.oublie_detail'));
        } catch (erreur) {
            Toast.error(I18n.t('common.error'), erreur.message);
        }
    },

    loadSettings() {
        if (this.chargementEnCours) return this.chargementEnCours;
        this.chargementEnCours = this.chargerLesReglages()
            .finally(() => { this.chargementEnCours = null; });
        return this.chargementEnCours;
    },

    async chargerLesReglages() {
        try {
            const config = await API.getSettings();
            this.config = config;
            this.populateForm(config);
        } catch (error) {
            Toast.error(I18n.t('common.error'), I18n.t('settings.load_failed'));
        }
        // Les règles de périmètre ne sont pas dans la configuration : elles
        // vivent dans la Knowledge Base, avec les autres décisions de
        // gouvernance. Un échec de leur lecture ne doit pas empêcher l'écran
        // de servir pour le reste.
        await this.chargerPerimetre();
        await this.chargerExclusions();
        await this.chargerAssistance();
        // Le dénombrement des comptes marqués : il ne se déduit pas de la
        // configuration, il se calcule sur les identités chargées. Deux
        // workspaces portant la même liste n'y marquent pas le même nombre de
        // comptes, et c'est précisément ce que l'écran doit montrer.
        await this.chargerLeDenombrementDesPrivileges();
        // Le découpage des noms de droits : même raison. Une convention se
        // reconnaît à ce qu'elle produit sur **ce** référentiel, pas à ce
        // qu'elle dit.
        await this.chargerLeDecoupage();
        // Le moteur de modèle : lu en dernier, parce qu'il ne vient pas du
        // serveur mais de l'exécution elle-même.
        await this.chargerLeModeleLocal();
    },

    populateForm(config) {
        // Global settings
        this.setFieldValue('cfg-cardinality', config.mining_attribute_max_cardinality_ratio);
        this.setFieldValue('cfg-min-users', config.mining_min_users);
        this.setFieldValue('cfg-min-rights', config.mining_min_rights);
        // La borne du croisement des profils. Rendue telle quelle, sans repli
        // écrit ici : le serveur en rend toujours une, et en inventer une côté
        // client afficherait une limite que le moteur n'applique pas.
        this.setFieldValue('cfg-profils-croises', config.mining_profils_croises_max);
        // Le plafond du nombre de rôles. Même règle : aucun repli écrit
        // ici, sans quoi l'écran afficherait une limite que le serveur
        // n'applique pas — et c'est exactement le défaut corrigé.
        this.setFieldValue('cfg-max-roles-plafond',
                           config.mining_max_roles_plafond);
        // L'apport minimal d'un rôle. Même règle : rendu tel quel, sans repli
        // écrit ici — un plancher inventé côté client écarterait des rôles que
        // le moteur retient.
        this.setFieldValue('cfg-apport-minimal', config.mining_apport_minimal);
        // Les bornes d'export surveillées. Rendues telles quelles, liste vide
        // comprise : une liste vide éteint le contrôle, et c'est une décision
        // de l'utilisateur — la remplacer par celle du produit reviendrait à
        // rallumer un contrôle qu'il a éteint.
        this.setFieldValue('cfg-troncature-bornes',
                           (config.troncature_bornes || []).join(', '));
        this.setFieldValue('cfg-health-alert', config.health_threshold_alert);
        this.setFieldValue('cfg-health-critical', config.health_threshold_critical);

        // Mining page field
        this.setFieldValue('mining-min-users', config.mining_min_users);
        // L'écran métier a ses propres champs : les mêmes seuils, sur l'écran
        // qui s'en sert.
        this.setFieldValue('biz-min-users', config.mining_min_users);
        this.setFieldValue('biz-min-rights', config.mining_min_rights);

        // Fragments de nom signalant un droit sensible : la liste appartient
        // au client, l'interface n'en présume aucune.
        this.setFieldValue('cfg-sensitive-rights',
                           (config.sensitive_right_keywords || []).join(', '));

        // Le marquage des comptes à privilèges : la liste, la colonne où
        // chercher, et la place du fragment. Aucun repli écrit ici — le
        // serveur rend toujours une place, et en inventer une côté client
        // afficherait une règle que le produit n'applique pas.
        this.setFieldValue('cfg-privileged-keywords',
                           (config.privileged_account_keywords || []).join(', '));
        this.setFieldValue('cfg-privileged-column',
                           config.privileged_account_column || '');
        this.setFieldValue('cfg-privileged-place', config.privileged_account_place);

        // La convention de nommage des droits. Les rôles des positions sont
        // conservés ici et non lus dans l'écran : la section peut n'avoir
        // jamais été dépliée, et un enregistrement effacerait alors une
        // convention que personne n'a touchée.
        this.positionsDeclarees = (config.right_naming_positions || []).slice();
        this.setFieldValue('cfg-naming-column', config.right_naming_column || '');
        this.setFieldValue('cfg-naming-separator',
                           config.right_naming_separator || '');
        this.setFieldValue('cfg-naming-positions',
                           this.positionsDeclarees.length || '');

        this.populateKeyPolicy(config.data_quality || {});
        this.chargerRegles(config.transformations || {});

        // File configs
        const files = config.files || {};
        
        ['identities', 'applications', 'rights'].forEach(key => {
            const f = files[key];
            if (f) {
                this.setFieldValue(`cfg-${key}-path`, f.path);
                this.setFieldValue(`cfg-${key}-delimiter`, f.delimiter);
                this.setFieldValue(`cfg-${key}-encoding`, f.encoding);
                this.setFieldValue(`cfg-${key}-id-col`, f.id_column);
            }
        });

        // Le rattachement droit → application : lu par le chargeur, absent de
        // l'écran. Sans lui, un référentiel de droits qui ne nomme pas
        // l'application comme le fichier des applications ne se joint à rien.
        if (files.rights) {
            this.setFieldValue('cfg-rights-app-id-col', files.rights.app_id_column);
        }

        // Habilitations special case
        const habs = files.habs;
        if (habs) {
            this.setFieldValue('cfg-habs-path', habs.path);
            this.setFieldValue('cfg-habs-delimiter', habs.delimiter);
            this.setFieldValue('cfg-habs-encoding', habs.encoding);
            this.setFieldValue('cfg-habs-user-id-col', habs.user_id_column);
            this.setFieldValue('cfg-habs-right-id-col', habs.right_id_column);
        }
    },

    /**
     * Renseigne les listes de la politique de qualité des clés.
     *
     * Aucune valeur de repli n'est écrite ici : le serveur rend toujours un
     * défaut complet, et inventer une valeur côté client afficherait un
     * réglage que le produit n'applique pas. Une surcharge absente laisse la
     * liste sur « comme le défaut », qui est bien ce qui se passe.
     *
     * @param {Object} politique document `data_quality` du workspace.
     */
    populateKeyPolicy(politique) {
        const defaut = politique.default || {};
        this.setFieldValue('cfg-key-policy-default-empty', defaut.empty_key);
        this.setFieldValue('cfg-key-policy-default-duplicate', defaut.duplicate_key);

        const surcharges = politique.files || {};
        this.REFERENTIELS.forEach((referentiel) => {
            const surcharge = surcharges[referentiel] || {};
            this.setFieldValue(`cfg-key-policy-${referentiel}-empty`,
                               surcharge.empty_key || '');
            this.setFieldValue(`cfg-key-policy-${referentiel}-duplicate`,
                               surcharge.duplicate_key || '');
        });
    },

    /**
     * Relève la politique saisie.
     *
     * Une surcharge vide n'est pas envoyée : « comme le défaut » se dit par
     * l'absence, pas par une valeur recopiée qui figerait le référentiel sur
     * la valeur du jour et cesserait de suivre le défaut du workspace.
     *
     * @returns {Object} document `data_quality` à enregistrer.
     */
    collectKeyPolicy() {
        const politique = {
            default: {
                empty_key: this.getFieldValue('cfg-key-policy-default-empty'),
                duplicate_key: this.getFieldValue('cfg-key-policy-default-duplicate'),
            },
            files: {},
        };
        this.REFERENTIELS.forEach((referentiel) => {
            const surcharge = {};
            const vide = this.getFieldValue(`cfg-key-policy-${referentiel}-empty`);
            const doublon = this.getFieldValue(`cfg-key-policy-${referentiel}-duplicate`);
            if (vide) surcharge.empty_key = vide;
            if (doublon) surcharge.duplicate_key = doublon;
            if (Object.keys(surcharge).length > 0) {
                politique.files[referentiel] = surcharge;
            }
        });
        return politique;
    },

    // ------------------------------------------- transformations au chargement

    /**
     * Reconstruit la liste des règles depuis le document du workspace.
     *
     * Le document range les règles par référentiel ; l'écran les affiche à
     * plat, dans l'ordre où elles s'appliquent. Le regroupement est refait à
     * l'enregistrement.
     *
     * @param {Object} document `transformations` du workspace.
     */
    chargerRegles(document_) {
        this.regles = [];
        this.REFERENTIELS.forEach((referentiel) => {
            (document_[referentiel] || []).forEach((regle) => {
                this.regles.push({
                    referential: referentiel,
                    column: regle.column || '',
                    operation: regle.operation || this.OPERATIONS[0],
                    value: regle.value || '',
                    // Portée telle quelle : sans elle, enregistrer depuis cet
                    // écran effacerait la table d'une règle de recodage — le
                    // serveur reçoit le document entier et n'a rien pour
                    // deviner ce que le client n'a pas renvoyé.
                    table: regle.table || null,
                });
            });
        });
        this.renderRegles();
    },

    ajouterRegle() {
        this.regles.push({
            referential: this.REFERENTIELS[0],
            column: '',
            operation: this.OPERATIONS[0],
            value: '',
            table: null,
        });
        this.renderRegles();
    },

    /**
     * Retire une règle, ou la déplace d'un cran.
     *
     * L'ordre est le sens même du mécanisme : découper une cellule puis
     * élaguer chaque morceau n'est pas la même chose que l'inverse. Il doit
     * donc se régler, et se voir.
     */
    agirSurRegle(action, index) {
        if (!this.regles[index]) return;
        if (action === 'remove') {
            this.regles.splice(index, 1);
        } else {
            const cible = action === 'up' ? index - 1 : index + 1;
            if (cible < 0 || cible >= this.regles.length) return;
            const memoire = this.regles[cible];
            this.regles[cible] = this.regles[index];
            this.regles[index] = memoire;
        }
        this.renderRegles();
    },

    /**
     * Enregistre une saisie.
     *
     * @param {number} index rang de la règle.
     * @param {string} champ champ modifié.
     * @param {string} valeur nouvelle valeur.
     * @param {boolean} redessiner faux pendant la frappe : redessiner à chaque
     *   caractère ferait perdre le curseur du champ en cours de saisie.
     */
    modifierRegle(index, champ, valeur, redessiner = true) {
        const regle = this.regles[index];
        if (!regle) return;
        regle[champ] = valeur;
        // Une opération sans valeur ne doit pas en conserver une : le serveur
        // refuse le document, et l'utilisateur ne verrait pas pourquoi.
        if (champ === 'operation' && !this.exigeUneValeur(regle.operation)) {
            regle.value = '';
        }
        if (redessiner) this.renderRegles();
    },

    exigeUneValeur(operation) {
        return this.OPERATIONS_AVEC_VALEUR.indexOf(operation) !== -1;
    },

    renderRegles() {
        const conteneur = document.getElementById('transformation-rules');
        if (!conteneur) return;

        if (this.regles.length === 0) {
            conteneur.innerHTML = `<p class="form-hint">${
                Utils.escapeHtml(I18n.t('settings.transformations.empty'))}</p>`;
            return;
        }

        conteneur.innerHTML = this.regles.map(
            (regle, index) => this.ligneRegle(regle, index)).join('');
    },

    ligneRegle(regle, index) {
        // La clé est construite par une fonction plutôt que par une
        // concaténation avec un préfixe littéral : un préfixe entre guillemets
        // ressemble à une clé tronquée, et la garde qui vérifie l'existence
        // des clés le signale comme absent des catalogues — à juste titre,
        // puisqu'il n'en est pas une.
        const options = (valeurs, choisie, cle) => valeurs.map(
            (valeur) => `<option value="${Utils.escapeHtml(valeur)}"${
                valeur === choisie ? ' selected' : ''}>${
                Utils.escapeHtml(I18n.t(cle(valeur)))}</option>`).join('');

        const avecValeur = this.exigeUneValeur(regle.operation);
        const avecTable = this.OPERATIONS_AVEC_TABLE.indexOf(regle.operation) !== -1;
        const bouton = (action, cle, icone) => `
            <button type="button" class="btn-link btn-sm" data-tf-action="${action}"
                    data-tf-index="${index}"
                    aria-label="${Utils.escapeHtml(I18n.t(cle))}">
                <i class="fas ${icone}" aria-hidden="true"></i>
            </button>`;

        return `
            <div class="transformation-rule" data-tf-rule="${index}">
                <select class="form-input" data-tf-champ="referential" data-tf-index="${index}"
                        aria-label="${Utils.escapeHtml(I18n.t('settings.transformations.referential'))}">
                    ${options(this.REFERENTIELS, regle.referential,
                              (v) => `quality.referential.${v}`)}
                </select>
                <input type="text" class="form-input" data-tf-champ="column" data-tf-index="${index}"
                       value="${Utils.escapeHtml(regle.column)}"
                       data-definition="definition.transformations.column"
                       aria-label="${Utils.escapeHtml(I18n.t('settings.transformations.column'))}">
                <select class="form-input" data-tf-champ="operation" data-tf-index="${index}"
                        aria-label="${Utils.escapeHtml(I18n.t('settings.transformations.operation'))}">
                    ${options(this.OPERATIONS, regle.operation,
                              (v) => `transformation.operation.${v}`)}
                </select>
                ${avecTable ? `
                <span class="form-hint" data-tf-table="${index}">${Utils.escapeHtml(
                    I18n.t('settings.transformations.table_entries',
                           { count: Object.keys(regle.table || {}).length }))}</span>`
                : `
                <input type="text" class="form-input" data-tf-champ="value" data-tf-index="${index}"
                       value="${Utils.escapeHtml(regle.value)}"${avecValeur ? '' : ' disabled'}
                       placeholder="${Utils.escapeHtml(I18n.t('settings.transformations.value_placeholder'))}"
                       aria-label="${Utils.escapeHtml(I18n.t('settings.transformations.value'))}">`}
                ${bouton('up', 'settings.transformations.up', 'fa-arrow-up')}
                ${bouton('down', 'settings.transformations.down', 'fa-arrow-down')}
                ${bouton('remove', 'settings.transformations.remove', 'fa-trash')}
            </div>`;
    },

    /**
     * Range les règles par référentiel, en conservant leur ordre relatif.
     *
     * @returns {Object} document `transformations`, ou `{}` si aucune règle.
     */
    collectTransformations() {
        const document_ = {};
        this.regles.forEach((regle) => {
            const rangee = { column: regle.column.trim(), operation: regle.operation };
            if (this.exigeUneValeur(regle.operation)) rangee.value = regle.value;
            if (regle.table) rangee.table = regle.table;
            if (!document_[regle.referential]) document_[regle.referential] = [];
            document_[regle.referential].push(rangee);
        });
        return document_;
    },

    /**
     * Première règle mal saisie, ou rien.
     *
     * Le serveur refuse le document entier : dire ici ce qui cloche évite à
     * l'utilisateur de chercher laquelle des six règles il a ratée.
     *
     * @returns {string|null} clé du message à afficher.
     */
    premierDefautDeRegle() {
        for (const regle of this.regles) {
            if (!regle.column.trim()) return 'settings.transformations.column_required';
            if (this.exigeUneValeur(regle.operation) && !regle.value) {
                return 'settings.transformations.value_required';
            }
            // Une règle de recodage sans table ne fait rien, et le serveur la
            // refuserait : le dire ici évite de chercher laquelle des sept.
            if (this.OPERATIONS_AVEC_TABLE.indexOf(regle.operation) !== -1
                && !(regle.table && Object.keys(regle.table).length)) {
                return 'settings.transformations.table_required';
            }
        }
        return null;
    },

    setFieldValue(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined) {
            el.value = value;
        }
    },

    getFieldValue(id, defaultValue = '') {
        const el = document.getElementById(id);
        return el ? el.value : defaultValue;
    },

    async saveSettings() {
        const defaut = this.premierDefautDeRegle();
        if (defaut) {
            Toast.error(I18n.t('common.error'), I18n.t(defaut));
            return;
        }

        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> <span>${Utils.escapeHtml(I18n.t('action.saving'))}</span>`;
        }

        try {
            const config = {
                mining_attribute_max_cardinality_ratio: parseFloat(this.getFieldValue('cfg-cardinality')),
                mining_min_users: parseInt(this.getFieldValue('cfg-min-users'), 10),
                mining_min_rights: parseInt(this.getFieldValue('cfg-min-rights'), 10),
                mining_profils_croises_max: parseInt(
                    this.getFieldValue('cfg-profils-croises'), 10),
                mining_max_roles_plafond: parseInt(
                    this.getFieldValue('cfg-max-roles-plafond'), 10),
                mining_apport_minimal: parseInt(
                    this.getFieldValue('cfg-apport-minimal'), 10),
                troncature_bornes: Utils.parseCSV(
                    this.getFieldValue('cfg-troncature-bornes'))
                    .map((valeur) => parseInt(valeur, 10))
                    .filter((valeur) => Number.isFinite(valeur)),
                health_threshold_alert: parseFloat(this.getFieldValue('cfg-health-alert')),
                health_threshold_critical: parseFloat(this.getFieldValue('cfg-health-critical')),
                sensitive_right_keywords: Utils.parseCSV(
                    this.getFieldValue('cfg-sensitive-rights')),
                privileged_account_keywords: Utils.parseCSV(
                    this.getFieldValue('cfg-privileged-keywords')),
                privileged_account_column: this.getFieldValue('cfg-privileged-column'),
                privileged_account_place: this.getFieldValue('cfg-privileged-place'),
                right_naming_column: this.getFieldValue('cfg-naming-column'),
                right_naming_separator: this.getFieldValue('cfg-naming-separator'),
                // Même raison que pour la politique des clés : un champ absent
                // de l'envoi reprend la valeur de départ du schéma, et la
                // convention disparaîtrait.
                right_naming_positions: this.collectPositionsDeNommage(),
                // Sans cette ligne, enregistrer depuis cet écran remettrait la
                // politique de qualité des clés à sa valeur de départ : le
                // serveur fusionne le document reçu, et un champ absent du
                // modèle rendu par l'écran reprend le défaut du schéma.
                data_quality: this.collectKeyPolicy(),
                // Même raison que pour la politique des clés : un champ absent
                // de l'envoi reprend la valeur de départ du schéma, et les
                // règles de transformation disparaîtraient.
                transformations: this.collectTransformations(),
                files: {
                    identities: {
                        path: this.getFieldValue('cfg-identities-path'),
                        delimiter: this.getFieldValue('cfg-identities-delimiter') || ';',
                        encoding: this.getFieldValue('cfg-identities-encoding') || 'utf-8',
                        id_column: this.getFieldValue('cfg-identities-id-col')
                    },
                    applications: {
                        path: this.getFieldValue('cfg-applications-path'),
                        delimiter: this.getFieldValue('cfg-applications-delimiter') || ';',
                        encoding: this.getFieldValue('cfg-applications-encoding') || 'utf-8',
                        id_column: this.getFieldValue('cfg-applications-id-col')
                    },
                    rights: {
                        path: this.getFieldValue('cfg-rights-path'),
                        delimiter: this.getFieldValue('cfg-rights-delimiter') || ';',
                        encoding: this.getFieldValue('cfg-rights-encoding') || 'utf-8',
                        id_column: this.getFieldValue('cfg-rights-id-col'),
                        app_id_column: this.getFieldValue('cfg-rights-app-id-col')
                    },
                    habs: {
                        path: this.getFieldValue('cfg-habs-path'),
                        delimiter: this.getFieldValue('cfg-habs-delimiter') || ';',
                        encoding: this.getFieldValue('cfg-habs-encoding') || 'utf-8',
                        user_id_column: this.getFieldValue('cfg-habs-user-id-col'),
                        right_id_column: this.getFieldValue('cfg-habs-right-id-col')
                    }
                }
            };

            await API.saveSettings(config);
            this.config = config;

            Toast.success(I18n.t('common.success'), I18n.t('settings.saved'));

            // Les règles de périmètre ont leur propre route — elles vivent
            // dans la Knowledge Base, pas dans la configuration — mais le même
            // bouton : un écran, un enregistrement.
            //
            // Leur échec ne doit ni faire échouer le reste, ni passer sous
            // silence : la configuration est bien enregistrée, les règles ne le
            // sont pas, et l'utilisateur doit savoir laquelle des deux — sans
            // quoi il croirait son périmètre restreint alors qu'il ne l'est pas.
            await this.enregistrerPerimetre();
            await this.enregistrerAssistance();

            // Le dénombrement porte sur la déclaration **enregistrée** : le
            // rafraîchir avant l'envoi montrerait ce que marquait l'ancienne
            // liste sous la nouvelle, ce qui est le plus sûr moyen de faire
            // retenir un fragment pour les comptes d'un autre.
            await this.chargerLeDenombrementDesPrivileges();
            await this.chargerLeDecoupage();

            // Update mining page field
            this.setFieldValue('mining-min-users', config.mining_min_users);
            // L'écran métier a ses propres champs : les mêmes seuils, sur
            // l'écran qui s'en sert.
            this.setFieldValue('biz-min-users', config.mining_min_users);
            this.setFieldValue('biz-min-rights', config.mining_min_rights);

        } catch (error) {
            Toast.error(I18n.t('common.error'), error.message || I18n.t('settings.save_failed'));
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="fas fa-save" aria-hidden="true"></i> <span>${Utils.escapeHtml(I18n.t('action.save'))}</span>`;
            }
        }
    }
};

window.SettingsPage = SettingsPage;
