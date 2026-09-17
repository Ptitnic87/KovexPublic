# Kovex

Une plateforme de *role mining* et de gouvernance des identités, qui tourne
**entièrement dans un onglet**. Rien à installer, rien à faire valider.

**→ [Ouvrir Kovex](https://ptitnic87.github.io/KovexPublic/)**

*Premier chargement : environ 34 Mo et une dizaine de secondes, une seule fois.
Ensuite tout est en cache.*

---

## La donnée ne sort pas

Le calcul a lieu sur votre poste. Les fichiers que vous chargez sont lus par le
navigateur et n'atteignent aucun serveur — il n'y en a pas : **le backend
s'exécute dans la page**, en Python compilé en WebAssembly.

Rien ne quitte votre machine tant que vous n'avez pas explicitement ouvert une
colonne à un modèle de langage, colonne par colonne et usage par usage, tout
étant fermé par défaut. **Les identités ne sortent jamais, dans aucun cas.**

Vous pouvez enregistrer la page et couper le réseau : elle fonctionne à
l'identique.

## Ce que ça fait

| | |
|---|---|
| **Explorer** | identités, applications, droits, et la santé du référentiel |
| **Préparer** | qualité des données, cohérence des valeurs, droits socles, comptes à privilèges |
| **Miner** | rôles applicatifs et rôles métier, seuil de similarité, apport minimal d'un rôle |
| **Arbitrer** | couverture, sur-octroi, et les habilitations qu'aucun rôle n'explique |
| **Gouverner** | séparation des tâches, dérogations, droits conservés après une mobilité |
| **Livrer** | catalogue de rôles, cartographie, export du modèle |

Le mining est **déterministe** : deux exécutions sur les mêmes données et les
mêmes bornes rendent le même modèle, au rôle près. C'est de l'algèbre
d'ensembles, pas un modèle de langage. À seuil θ = 1, le sur-octroi est **nul
par construction** — aucun membre ne reçoit un droit qu'il ne détient pas déjà.

## Ce qui est dit, et jamais tu

Un calcul borné est annoncé **avec** son résultat, jamais après :

- le plafond de rôles atteint alors qu'il restait des candidats ;
- le croisement des profils réduit à un échantillon ;
- les rôles écartés faute d'apport suffisant ;
- les exports qui tombent *exactement* sur un plafond courant — 1 000, 5 000,
  65 536 — et qui sont peut-être tronqués à la source ;
- la raison invoquée par un modèle, montrée telle qu'il l'a écrite, pour qu'un
  humain puisse la contredire.

Une couverture lue sans savoir qu'elle a été coupée est une couverture mal lue.

## La même chose que la version serveur

Ce n'est pas une version allégée, ni une réécriture : **c'est le même code**.
Le même moteur, les mêmes routes, la même validation. La seule pièce propre à
cette page remplace l'appel réseau par un appel direct à l'application qui
tourne dans l'onglet.

Vérifié sur un même jeu : la version page et la version serveur rendent 71
rôles, 79,53 % de couverture, zéro sur-octroi, et **toutes** les statistiques
identiques à la décimale.

## Licence

**Propriétaire. Tous droits réservés.** Voir [LICENSE](LICENSE).

Le code est lisible parce que le format l'exige — c'est une page web, et son
moteur s'exécute dans votre navigateur. Lisible ne veut pas dire concédé :
aucun droit d'utilisation, de reproduction, de modification ni de distribution
n'est accordé par le seul fait d'y avoir accès.

Les bibliothèques tierces embarquées restent régies par leurs licences
respectives.

Pour un usage professionnel, une évaluation ou un partenariat :
[Nicolas Cudon](https://github.com/Ptitnic87).
