# Trainingslogboek

Persoonlijk trainingslogboek als installeerbare webapp (PWA). Sessies A en B, een
progressieladder per oefening, rusttimer, lichaamsgewicht met weekgemiddelden,
en export naar CSV en JSON.

**Alle gegevens blijven op je eigen apparaat.** De app slaat op in `localStorage`
van je browser en stuurt niets naar een server. De webserver levert alleen de
statische bestanden.

## Publiceren via GitHub Pages

1. Maak een nieuwe **publieke** repository, bijvoorbeeld `trainingslogboek`.
2. Zet alle bestanden uit deze map in de hoofdmap van de repo.
3. Ga naar **Settings → Pages**.
4. Kies bij *Source* de optie **Deploy from a branch**, met branch `main` en map `/ (root)`.
5. Wacht een minuut. Je adres wordt `https://<gebruikersnaam>.github.io/trainingslogboek/`.

Alle paden in `index.html`, `manifest.webmanifest` en `sw.js` zijn relatief
(`./app.js`), dus de app werkt zowel in de hoofdmap als in een submap.

### Bijwerken

Pas een bestand aan in de repo. De service worker haalt `app.js` en het manifest
netwerk-eerst op, dus de nieuwe versie staat na een herstart van de app op je
telefoon. Wijzig je andere bestanden, verhoog dan `VERSION` bovenin `sw.js`.

## Op je iPhone zetten

1. Open het adres in **Safari** (niet in Chrome — alleen Safari kan installeren).
2. Tik op het deelicoon onderin.
3. Kies **Zet op beginscherm**.
4. Bevestig met **Voeg toe**.

De app opent nu zonder adresbalk, met een eigen icoon. Na de eerste start werkt
hij offline; alleen die eerste keer is internet nodig om React en Recharts te laden.

## Back-up

`localStorage` verdwijnt als je Safari-website­gegevens wist of de app van je
beginscherm verwijdert. Maak daarom af en toe een back-up via
**Analyse → Gegevens beheren → JSON-back-up**. Bewaar dat bestand ergens buiten
je telefoon.

## Zelf hosten in plaats van Pages

Dezelfde bestanden werken ongewijzigd achter elke statische webserver, bijvoorbeeld
een nginx-container achter een reverse proxy. Vereiste is HTTPS met een certificaat
dat het apparaat vertrouwt — zonder HTTPS staat *Zet op beginscherm* geen
service worker toe.

## Licentie

MIT
