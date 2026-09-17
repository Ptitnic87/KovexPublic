/**
 * Le pont : le frontend de Kovex, inchangé, parlant à son backend qui tourne
 * dans la page.
 *
 * L'interface émet ses requêtes avec `fetch`, sur `/api/v1/…`. On remplace
 * `fetch` — et **rien d'autre**. Aucune ligne du frontend n'est touchée : ni
 * `api.js`, ni les quinze écrans, ni leurs tests. Une route, un corps, un code
 * d'erreur : ce que l'interface reçoit est ce que l'application ASGI a produit,
 * la validation Pydantic comprise.
 *
 * C'est ce qui permet d'affirmer qu'il n'y a **aucune différence** : ce n'est
 * pas une autre application qui imite la première, c'est la même.
 */
(function () {
  "use strict";

  const RACINE = "./moteur/";

  const ROUES = [
    "numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl",
    "scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",
    "pandas-3.0.2-cp314-cp314-pyemscripten_2026_0_wasm32.whl",
    "pydantic_core-2.41.5-cp314-cp314-pyemscripten_2026_0_wasm32.whl",
    "pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",
    "annotated_types-0.7.0-py3-none-any.whl",
    "annotated_doc-0.0.4-py3-none-any.whl",
    "typing_extensions-4.15.0-py3-none-any.whl",
    "typing_inspection-0.4.2-py3-none-any.whl",
    "pydantic-2.12.5-py3-none-any.whl",
    "sniffio-1.3.1-py3-none-any.whl",
    "idna-3.11-py3-none-any.whl",
    "anyio-4.13.0-py3-none-any.whl",
    "starlette-1.0.0-py3-none-any.whl",
    "fastapi-0.136.1-py3-none-any.whl",
    "six-1.17.0-py2.py3-none-any.whl",
    "python_dateutil-2.9.0.post0-py2.py3-none-any.whl",
    "pytz-2026.1.post1-py2.py3-none-any.whl",
    "pyjwt-2.14.0-py3-none-any.whl",
  ];

  //: Celles que Pyodide ne connaît pas : on les dépose à la main, parce que
  //: `micropip` irait les chercher sur le réseau et qu'il n'y a pas de réseau.
  const ROUES_DEPOSEES = [
    "et_xmlfile-2.0.0-py3-none-any.whl",
    "openpyxl-3.2.0b1-py2.py3-none-any.whl",
    "python_dotenv-1.2.3-py3-none-any.whl",
    "python_multipart-0.0.32-py3-none-any.whl",
    "reportlab-4.5.1-py3-none-any.whl",
  ];

  const PREPARATION = `
import os, sys, functools
os.chdir("/kovex")
sys.path.insert(0, "/kovex")
os.environ.setdefault("PYGIA_ENV", "development")
os.environ.setdefault("PYGIA_AUTH_DISABLED", "true")
os.environ.setdefault("PYGIA_SECRET_KEY", "page-autonome")

# Un navigateur n'a pas de fil d'exécution à prêter. FastAPI en réclame un pour
# tout endpoint qui n'est pas "async def", et le produit appelle
# run_in_threadpool pour ses calculs longs. On exécute directement.
#
# Ce n'est pas une dégradation : il y a un seul utilisateur, et la pile entière
# tourne dans un Worker — l'écran ne gèle pas davantage. Et c'est anyio qu'on
# adapte, pas Kovex : pas une ligne du produit ne change.
import anyio.to_thread, starlette.concurrency

async def _sans_fil(fonction, *args, abandon_on_cancel=False, cancellable=False,
                    limiter=None, **kwargs):
    return fonction(*args, **kwargs)

anyio.to_thread.run_sync = _sans_fil
starlette.concurrency.run_in_threadpool = (
    lambda fonction, *a, **k: _sans_fil(functools.partial(fonction, **k), *a))

from src.api.main import app
import json as _json

async def _appeler(methode, chemin, requete, entetes_json):
    """Conduit une requête à travers la pile ASGI, sans réseau."""
    corps = requete.encode() if requete else b""
    chemin, _, requete_brute = chemin.partition("?")
    entetes = [(cle.lower().encode(), valeur.encode())
               for cle, valeur in _json.loads(entetes_json).items()]
    entetes.append((b"host", b"kovex.page"))
    scope = {
        "type": "http", "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1", "method": methode.upper(), "scheme": "http",
        "path": chemin, "raw_path": chemin.encode(),
        "query_string": requete_brute.encode(), "root_path": "",
        "headers": entetes, "client": ("page", 0), "server": ("kovex.page", 80),
    }
    recu = []
    async def recevoir():
        return {"type": "http.request", "body": corps, "more_body": False}
    async def emettre(message):
        recu.append(message)
    await app(scope, recevoir, emettre)

    debut = next(m for m in recu if m["type"] == "http.response.start")
    charge = b"".join(m.get("body", b"") for m in recu
                      if m["type"] == "http.response.body")
    return _json.dumps({
        "statut": debut["status"],
        "entetes": {cle.decode(): valeur.decode() for cle, valeur in debut["headers"]},
        "corps": charge.decode("utf-8", "replace"),
    })
`;

  let pretDuMoteur = null;
  let appeler = null;

  /**
   * L'avancement du demarrage, dans le loader que l'interface a deja.
   *
   * Onze secondes de silence, ou plusieurs minutes sur une connexion lente,
   * se lisent comme une panne — et quelqu'un rechargera la page au milieu du
   * telechargement. Le loader de Kovex porte deja un texte et une barre : on
   * s'en sert plutot que d'en ajouter un.
   *
   * Les libelles passent par le catalogue quand il est charge, et tombent sur
   * un texte de repli sinon : le pont se met en place **avant** les scripts du
   * produit, donc avant l'i18n, et un ecran vide pendant ce temps-la serait
   * exactement le defaut qu'on veut eviter.
   */
  const REPLI = {
    runtime: "Telechargement du moteur — 34 Mo, une seule fois",
    bibliotheques: "Mise en place des bibliotheques de calcul",
    produit: "Chargement de Kovex",
    api: "Demarrage de l'API locale",
    pret: "Pret",
  };

  function annoncer(etape, part) {
    const texte = document.querySelector("#app-loader .loader-text");
    const barre = document.querySelector("#app-loader .loader-progress-bar");
    if (texte) {
      const cle = "loader.moteur." + etape;
      const traduit = (typeof I18n !== "undefined" && typeof I18n.t === "function")
        ? I18n.t(cle) : cle;
      texte.textContent = (traduit === cle) ? REPLI[etape] : traduit;
    }
    if (barre) {
      barre.style.animation = "none";
      barre.style.width = part + "%";
    }
    window.dispatchEvent(new CustomEvent("kovex:demarrage", {
      detail: { etape: etape, part: part } }));
  }

  async function demarrer() {
    annoncer("runtime", 5);
    const pyodide = await loadPyodide({ indexURL: RACINE });

    annoncer("bibliotheques", 25);
    await pyodide.loadPackage(ROUES.map((nom) => RACINE + nom));

    for (const nom of ROUES_DEPOSEES) {
      const octets = new Uint8Array(await (await fetch(RACINE + nom)).arrayBuffer());
      pyodide.unpackArchive(octets, "zip",
                            { extractDir: "/lib/python3.14/site-packages" });
    }

    annoncer("produit", 70);
    const source = new Uint8Array(
      await (await fetch(RACINE + "kovex-src.zip")).arrayBuffer());
    pyodide.unpackArchive(source, "zip", { extractDir: "/kovex" });

    annoncer("api", 85);
    await pyodide.runPythonAsync(PREPARATION);
    appeler = pyodide.globals.get("_appeler");

    annoncer("pret", 100);
    return pyodide;
  }

  /**
   * `fetch`, remplacé pour les seules adresses de l'API.
   *
   * Tout le reste — les feuilles de style, les polices, les données de la page
   * elle-même — passe par le `fetch` d'origine. On ne détourne que ce qui
   * s'adressait au serveur.
   */
  const fetchOrigine = window.fetch.bind(window);

  window.fetch = async function (ressource, options) {
    const adresse = typeof ressource === "string" ? ressource
                  : (ressource && ressource.url) || String(ressource);
    const chemin = adresse.replace(/^https?:\/\/[^/]+/, "");

    if (!/^\/(api\/|health\b)/.test(chemin)) {
      return fetchOrigine(ressource, options);
    }

    if (!pretDuMoteur) pretDuMoteur = demarrer();
    await pretDuMoteur;

    const reglages = options || {};
    const entetes = {};
    if (reglages.headers) {
      const lus = reglages.headers instanceof Headers
        ? reglages.headers : new Headers(reglages.headers);
      lus.forEach((valeur, cle) => { entetes[cle] = valeur; });
    }

    const rendu = JSON.parse(await appeler(
      reglages.method || "GET", chemin,
      typeof reglages.body === "string" ? reglages.body : "",
      JSON.stringify(entetes)));

    return new Response(rendu.corps, {
      status: rendu.statut,
      headers: rendu.entetes,
    });
  };

  /**
   * La session locale.
   *
   * L'interface montre son écran de connexion tant qu'aucune session n'est
   * enregistrée. Dans une page, cet écran ne protège rien : il y a un seul
   * utilisateur, sur sa propre machine, et le serveur qu'il interrogerait
   * tourne dans le même onglet. Demander un mot de passe pour accéder à ses
   * propres fichiers serait du théâtre.
   *
   * On pose donc la session que le backend accorde déjà dans ce mode —
   * `PYGIA_AUTH_DISABLED`, que `src/api/main.py` **refuse** dès que
   * `PYGIA_ENV=production`, et qui ne peut donc pas ouvrir une instance
   * servie. La page hérite de cette garantie : elle n'est jamais servie.
   *
   * Ce qui est protégé l'est ailleurs, et l'est vraiment : aucune donnée ne
   * sort sans qu'une colonne ait été ouverte à un modèle, et les identités ne
   * sortent jamais.
   */
  function poserLaSessionLocale() {
    try {
      if (localStorage.getItem("pygia_token")) return;
      localStorage.setItem("pygia_token", "page-autonome");
      localStorage.setItem("pygia_user", JSON.stringify({
        username: "local",
        email: "local@page",
        full_name: "Poste local",
        role: "admin",
        disabled: false,
        permissions: ["read", "write", "admin", "mining", "validate", "export"],
      }));
    } catch (erreur) {
      // Un navigateur qui refuse le stockage local — fenêtre privée, site
      // bloqué — laisse l'écran de connexion. Le dire vaut mieux que de
      // tourner sans comprendre.
      console.warn("kovex: stockage local indisponible, l'écran de connexion "
                   + "restera affiché — " + erreur);
    }
  }

  poserLaSessionLocale();

  // Le moteur démarre sans attendre la première requête : onze secondes de
  // chargement au premier appel de l'interface se liraient comme une panne.
  window.addEventListener("DOMContentLoaded", () => {
    if (!pretDuMoteur) {
      pretDuMoteur = demarrer();
      // Un démarrage qui échoue en silence laisse une page qui tourne sans
      // dire pourquoi : c'est le pire état possible pour qui l'ouvre.
      pretDuMoteur.catch((erreur) => {
        window.__PANNE = String(erreur && erreur.message || erreur);
        console.error("kovex: le moteur n'a pas démarré — " + window.__PANNE);
      });
    }
  });
})();
