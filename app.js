// ========================
// Burger-Toggle für Mobile-Menü
// ========================
var burger = document.querySelector('.header__navigation--toggle');
if (burger) {
	burger.addEventListener('click', function(){
		document.body.classList.toggle('menu-open');
		// Accessibility
		burger.setAttribute('aria-expanded', document.body.classList.contains('menu-open') ? 'true' : 'false');
	});
}
// Close-Button im Offcanvas-Menü schließt das Menü
document.querySelectorAll('.mobile-menu-close').forEach(function(btn){
	btn.addEventListener('click', function(){
		document.body.classList.remove('menu-open');
		var burger = document.querySelector('.header__navigation--toggle');
		if (burger) burger.setAttribute('aria-expanded', 'false');
	});
});
document.querySelectorAll('.menu--mobile .menu__link').forEach(function(link){
	link.addEventListener('click', function() {
		document.body.classList.remove('menu-open');
		var burger = document.querySelector('.header__navigation--toggle');
		if (burger) burger.setAttribute('aria-expanded', 'false');
	});
});

// ========================
// Kandidatenpool (ohne jQuery) – clevermatch
// ========================

const API_URL = "https://jobs.clevermatch.com/de/feeds/candidates/?v=2&iq=true&ps=50";

// --- Helper: Checkbox-Synchronisation für alle-Felder ---
function handleAllCheckbox(allCheckboxId, relatedSelector) {
	const allCheckbox = document.getElementById(allCheckboxId.replace('#',''));
	const relatedCheckboxes = document.querySelectorAll(relatedSelector);

	if (!allCheckbox) return;

	allCheckbox.addEventListener('change', function() {
		relatedCheckboxes.forEach(cb => { cb.checked = allCheckbox.checked; });
		fetchCandidates(1);
	});
	relatedCheckboxes.forEach(cb => {
		cb.addEventListener('change', function() {
			allCheckbox.checked = Array.from(relatedCheckboxes).every(i => i.checked);
			fetchCandidates(1);
		});
	});
}

// Setup "Alle auswählen" logik für Berufsfeld, Seniorität, Gehalt
handleAllCheckbox('allFieldOfWork', 'input[name="fieldOfWork"]:not(#allFieldOfWork)');
handleAllCheckbox('allSeniority', 'input[name="seniority"]:not(#allSeniority)');
handleAllCheckbox('allSalaryRanges', '.salary-range:not(#allSalaryRanges)');

// --- Salary-Range aus Salary-Checkboxes ---
function updateSalaryRange() {
	const checked = Array.from(document.querySelectorAll('.salary-range:checked:not(#allSalaryRanges)'));
	const min = checked.length ? Math.min(...checked.map(cb => Number(cb.dataset.min))) : 0;
	const max = checked.length ? Math.max(...checked.map(cb => Number(cb.dataset.max))) : 9999999;
	const minInput = document.getElementById('salary_min');
	const maxInput = document.getElementById('salary_max');
	if (minInput) minInput.value = min;
	if (maxInput) maxInput.value = max;
}
document.querySelectorAll('.salary-range').forEach(cb => {
	cb.addEventListener('change', updateSalaryRange);
});

// --- Stichwortsuche: Debounce ---
let searchTimer;
const keywordInput = document.querySelector('input[name="keyword"]');
if (keywordInput) {
	keywordInput.addEventListener('input', function() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => fetchCandidates(1), 1000);
	});
}

// --- Filterformular aktualisiert Ergebnisse ---
const cmFilterForm = document.getElementById('cmFilterForm');
if (cmFilterForm) {
	cmFilterForm.addEventListener('change', function() {
		fetchCandidates(1);
	});
}
// für weitere Filterformen (cmSearchForm, cmFilterModal) ggf. erweitern...

// --- Filter serialisieren (analog Plugin) ---
function serializeFilters() {
	const form = document.getElementById('cmFilterForm');
	if (!form) return {};

	const fd = new FormData(form);
	const filters = {};

	for (let entry of fd.entries()) {
		const [key, val] = entry;
		if (filters[key]) {
			filters[key] = Array.isArray(filters[key]) ? filters[key] : [filters[key]];
			filters[key].push(val);
		} else {
			filters[key] = val;
		}
	}

	for (let key in filters) {
		if (Array.isArray(filters[key])) filters[key] = filters[key].join(',');
	}
	// Spezialfall employmentTypes[] -> employmentTypes
	if (filters['employmentTypes[]']) {
		filters['employmentTypes'] = filters['employmentTypes[]'];
		delete filters['employmentTypes[]'];
	}

	// Salary Filter
	const minInput = document.getElementById('salary_min');
	const maxInput = document.getElementById('salary_max');
	filters['salary_min'] = minInput ? minInput.value : 0;
	filters['salary_max'] = maxInput ? maxInput.value : 9999999;

	return filters;
}

function showLoadingSpinner() {
	const spinner = document.getElementById('loadingSpinner');
	if (spinner) spinner.style.display = "";
	const candidateSection = document.getElementById('cmCandidatesContainer');
	if (candidateSection) candidateSection.style.opacity = "0.6";
}
function hideLoadingSpinner() {
	const spinner = document.getElementById('loadingSpinner');
	if (spinner) spinner.style.display = "none";
	const candidateSection = document.getElementById('cmCandidatesContainer');
	if (candidateSection) candidateSection.style.opacity = "";
}

function disableInputs(disabled = true) {
	const form = document.getElementById('cmFilterForm');
	if (!form) return;
	form.querySelectorAll("input, select").forEach(el => el.disabled = disabled);
}

// --- Hauptfunktion zum Laden der Kandidaten ---
function fetchCandidates(page = 1) {
	disableInputs(true);
	showLoadingSpinner();

	let filters = serializeFilters();
	filters['ps'] = 50;
	filters['p'] = page;
	let params = new URLSearchParams(filters);

	fetch(API_URL + "&" + params.toString())
		.then(resp => {
			if (!resp.ok) throw new Error("Netzwerkfehler.");
			return resp.json();
		})
		.then(data => {
			hideLoadingSpinner();
			disableInputs(false);

			if (data && data.candidates && data.candidates.length > 0) {
				displayCandidates(data);
				displayPagination(data.page, data.totalpages);
			} else {
				displayNoResults();
				displayPagination(1, 1);
			}
		})
		.catch(err => {
			hideLoadingSpinner();
			disableInputs(false);
			displayError("Es ist ein Fehler aufgetreten. Bitte später erneut versuchen.");
			console.error(err);
		});
}

// --- Rendering-Logik für Kandidaten ---
function displayCandidates(data) {
	const container = document.getElementById('cmCandidatesContainer');
	if (!container) return;
	container.innerHTML = "";

	let headline = document.createElement('div');
	headline.className = "candidate-count";
	headline.textContent = (data.totalno || data.candidates.length) + " Kandidat" + (data.totalno == 1 ? "" : "en") + " im Pool";
	container.appendChild(headline);

	data.candidates.forEach(candidate => {
		const card = document.createElement('div');
		card.className = "candidate-card";
		card.innerHTML = `
			<h3>${candidate.Title || ""}</h3>
			<ul>
				<li><strong>Region:</strong> ${candidate.Region || ""}</li>
				<li><strong>Branche:</strong> ${candidate.Industry || ""}</li>
				<li><strong>Alter:</strong> ${candidate.Age || ""}</li>
				<li><strong>Zielgehalt:</strong> ${candidate.SalaryExpectations || ""}</li>
				<li><strong>Zertifizierung:</strong> ${candidate.CertificationLevel || ""}</li>
			</ul>
			<a href="${candidate.Url}" target="_blank" rel="noopener" class="candidate-link">Details</a>
		`;
		container.appendChild(card);
	});
}

function displayNoResults() {
	const container = document.getElementById('cmCandidatesContainer');
	if (container) container.innerHTML = "<div class='no-candidates'>Leider kein Kandidat mit diesen Vorgaben gefunden.</div>";
}
function displayError(msg) {
	const container = document.getElementById('cmCandidatesContainer');
	if (container) container.innerHTML = `<div class='candidates-error'>${msg}</div>`;
}

// --- Pagination Buttons generieren & klicken ---
function displayPagination(currentPage, totalPages) {
	const container = document.getElementById('cmCandidatesContainer');
	let pagination = document.createElement('nav');
	pagination.className = "pagination";

	if (totalPages > 1) {
		for (let p = 1; p <= totalPages; p++) {
			let btn = document.createElement('button');
			btn.type = "button";
			btn.textContent = p;
			btn.className = (p === currentPage ? "active" : "");
			btn.onclick = () => fetchCandidates(p);
			pagination.appendChild(btn);
		}
		container.appendChild(pagination);
	}
}

// --- Initialen Start ---
document.addEventListener("DOMContentLoaded", function() {
	updateSalaryRange();
	if (document.getElementById('cmCandidatesContainer')) {
		fetchCandidates(1);
	}
});
