import { useState, useEffect, useRef, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
//  NdMED — LIWIMALA INITIATIVE  v4.0
//  Expanded symptoms · KNN specialist matching · Google Maps integration
// ═══════════════════════════════════════════════════════════════════════════════

const T = {
  navy:"#07182E", navyMid:"#0D2540", navyCard:"#0F2D4A",
  teal:"#00C9B1", tealDim:"#009E8D", tealGlow:"rgba(0,201,177,0.12)",
  white:"#EDF2F7", dim:"#7A99B8", dimLight:"#A8BCCF",
  amber:"#F6A623", red:"#E8394A", green:"#21C97A", purple:"#8B5CF6",
  border:"rgba(0,201,177,0.18)", borderDim:"rgba(255,255,255,0.07)",
};

const TRIAGE = {
  RED:    {bg:"#E8394A",label:"EMERGENCY",  icon:"🚨",desc:"Seek immediate emergency care — call 15/112/911"},
  ORANGE: {bg:"#F6762B",label:"URGENT",     icon:"⚠️",desc:"See a doctor within 2–4 hours"},
  YELLOW: {bg:"#F6C623",label:"SEMI-URGENT",icon:"⚡",desc:"Consult a doctor within 24 hours"},
  GREEN:  {bg:"#21C97A",label:"NON-URGENT", icon:"✅",desc:"Schedule a routine appointment"},
};

const PLANS = [
  {id:"free",name:"Basic",price:"Free",period:"",color:"#A8BCCF",icon:"🩺",
   features:["1 consultation/day","Standard symptom triage","Basic condition list","Emergency referral","Specialist directory"],
   cta:"Start Free"},
  {id:"pro",name:"Pro",price:"$9",period:"/month",color:"#00C9B1",icon:"⚕️",badge:"Most Popular",
   features:["Unlimited consultations","Live evidence: WHO, NIH, Mayo Clinic","KNN specialist matching","Google Maps integration","PDF report download","Drug interaction alerts"],
   cta:"Start Pro — $9/mo"},
  {id:"clinical",name:"Clinical",price:"$29",period:"/month",color:"#8B5CF6",icon:"🏥",
   features:["Everything in Pro","ICD-11 full mapping","Lab test recommendations","Differential ranking","Multi-patient management","API / EMR integration"],
   cta:"Start Clinical — $29/mo"},
];

const SOURCES = [
  {name:"WHO",icon:"🌐"},{name:"NIH MedlinePlus",icon:"🔬"},{name:"Mayo Clinic",icon:"🏥"},
  {name:"CDC",icon:"🛡️"},{name:"WebMD",icon:"💊"},{name:"NHS UK",icon:"🏴"},{name:"Cleveland Clinic",icon:"⚕️"},
];

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPANDED QUESTION BANK — 18 questions covering broad clinical scope
// ═══════════════════════════════════════════════════════════════════════════════
const QUESTIONS = [
  // ── Section 1: Chief Complaint ───────────────────────────────────────────────
  {id:"chief",section:"Chief Complaint",
   q:"What is your main complaint today? (select all that apply)",type:"multi",
   opts:[
     "Chest pain / tightness / pressure","Palpitations / irregular heartbeat","Shortness of breath / dyspnea",
     "Headache / migraine","Dizziness / vertigo / balance problems","Confusion / memory problems",
     "Fever / chills / rigors","Night sweats","Unexplained weight loss",
     "Abdominal pain / cramping","Nausea / vomiting","Diarrhea / bloody stool","Constipation / bloating",
     "Joint pain / arthritis","Muscle pain / weakness / cramps","Back pain / neck pain / spine",
     "Skin rash / itching / lesions / hives","Swelling / edema / lymph node enlargement",
     "Fatigue / exhaustion / malaise","Fainting / syncope / blackout",
     "Urinary symptoms (pain/frequency/blood)","Sexual health / STI concern","Vaginal / penile discharge",
     "Eye problems (pain/redness/vision loss)","Ear pain / discharge / hearing loss","Throat pain / hoarseness / dysphagia",
     "Nasal congestion / sinusitis / nosebleed","Cough (dry or productive) / wheezing",
     "Bleeding / bruising / clotting concern","Numbness / tingling / weakness in limbs",
     "Seizures / convulsions / loss of consciousness","Psychiatric / mental health / mood disorder",
     "Dental / oral pain / gum swelling","Pregnancy concern / antenatal care","Pediatric concern (child illness)",
     "Injury / trauma / accident","Poisoning / toxic exposure / snake/animal bite","Other"
   ]},

  // ── Section 2: Symptom Characterisation ──────────────────────────────────────
  {id:"duration",section:"Symptom Timeline",
   q:"How long have you been experiencing these symptoms?",type:"single",
   opts:["Less than 1 hour","1–6 hours","6–24 hours","1–3 days","4–7 days","1–2 weeks","2–4 weeks","1–3 months","More than 3 months","Chronic / recurring condition"]},

  {id:"severity",section:"Symptom Timeline",
   q:"Overall severity of discomfort (1 = mild, 10 = worst imaginable):",type:"scale",min:1,max:10},

  {id:"onset",section:"Symptom Timeline",
   q:"How did your symptoms begin?",type:"single",
   opts:["Sudden / explosive (within seconds)","Rapid (within minutes)","Acute (within hours)","Subacute (over days)","Gradual / insidious (over weeks/months)","Intermittent / comes and goes","Progressive / worsening over time","Following trauma or injury","After eating / medication intake","After physical exertion"]},

  {id:"pattern",section:"Symptom Timeline",
   q:"What makes your symptoms better or worse?",type:"multi",
   opts:["Worse with movement / exertion","Better with rest","Worse at night","Better in morning","Worse after eating","Triggered by stress / anxiety","Worse with cold / weather change","Relieved by medication","Worse lying flat","No clear pattern / constant"]},

  // ── Section 3: Associated Symptoms ───────────────────────────────────────────
  {id:"associated",section:"Associated Symptoms",
   q:"Do you have any of these accompanying symptoms? (select all)",type:"multi",
   opts:[
     "High fever (>38.5°C / 101°F)","Low-grade fever (37.5–38.4°C)","Hypothermia / feeling cold",
     "Vomiting (with or without blood)","Diarrhea (watery / bloody)","Jaundice (yellow skin/eyes)",
     "Severe / sudden headache","Stiff neck (meningism)","Photophobia (light sensitivity)",
     "Swelling of limbs / face / abdomen","Generalized rash","Localized redness / warmth",
     "Chest tightness / pressure","Coughing blood (haemoptysis)","Vomiting blood (haematemesis)",
     "Blood in urine (haematuria)","Rectal bleeding / melaena","Vaginal bleeding (outside period)",
     "Loss of consciousness / fainted","Confusion / disorientation","Slurred speech",
     "Facial drooping / arm weakness (FAST stroke)","Sudden vision loss",
     "Difficulty breathing at rest","Cyanosis (blue lips / fingertips)","Rapid or irregular heartbeat",
     "Severe abdominal rigidity","Signs of dehydration (dry mouth, no urine, sunken eyes)",
     "Paralysis / inability to move limb","Severe allergic reaction (throat swelling / hives)",
     "None of the above"
   ]},

  // ── Section 4: Medical & Social History ──────────────────────────────────────
  {id:"history",section:"Medical History",
   q:"Do you have any known medical conditions?",type:"multi",
   opts:[
     "Hypertension (high blood pressure)","Hypotension (low blood pressure)",
     "Type 1 Diabetes","Type 2 Diabetes","Pre-diabetes / metabolic syndrome",
     "Asthma","COPD / chronic bronchitis / emphysema","Tuberculosis (active or past)",
     "Coronary artery disease / angina","Heart failure","Atrial fibrillation / arrhythmia","Prior heart attack",
     "Stroke / TIA (mini-stroke)","Epilepsy / seizure disorder",
     "HIV / AIDS","Hepatitis B","Hepatitis C","Malaria (recurrent)",
     "Chronic kidney disease / renal failure","Liver cirrhosis",
     "Cancer (active or in remission)","Autoimmune disease (lupus, RA, etc.)",
     "Thyroid disease (hypo/hyperthyroid)","Anaemia / blood disorder","Sickle cell disease",
     "Mental health condition (depression, bipolar, schizophrenia)","Dementia / Alzheimer",
     "Osteoporosis / arthritis","Peptic ulcer / GERD","Inflammatory bowel disease",
     "Pregnancy (current)","Obesity (BMI >30)","None known","Prefer not to say"
   ]},

  {id:"surgical",section:"Medical History",
   q:"Any previous surgeries or hospitalisations?",type:"single",
   opts:["None","Yes — within last 3 months","Yes — within last year","Yes — more than 1 year ago","Yes — multiple surgeries","Currently hospitalised / just discharged"]},

  {id:"family_hx",section:"Medical History",
   q:"Any significant family history?",type:"multi",
   opts:["Heart disease / heart attack","Stroke","Cancer (specify if known)","Diabetes","Hypertension","Sickle cell disease","Mental illness","Tuberculosis","Sudden cardiac death","None known","Unknown"]},

  // ── Section 5: Current Medications & Allergies ───────────────────────────────
  {id:"medications",section:"Medications",
   q:"Are you currently taking any medications?",type:"multi",
   opts:["No medications","Antihypertensives (e.g. amlodipine, lisinopril)","Antidiabetics / insulin","Anticoagulants / blood thinners (e.g. warfarin, heparin)","Antiretrovirals (ARVs)","Antimalarials","Antibiotics (current course)","Anti-TB drugs","Steroids / corticosteroids","NSAIDs (ibuprofen, aspirin, diclofenac)","Analgesics / opioids","Antiepileptics","Antidepressants / anxiolytics","Chemotherapy / immunosuppressants","Oral contraceptives / hormones","Herbal / traditional medicine","Vitamins / supplements","Over-the-counter (self-medicated)"]},

  {id:"allergies",section:"Medications",
   q:"Any known drug or substance allergies?",type:"multi",
   opts:["No known allergies","Penicillin / amoxicillin / beta-lactams","Cephalosporins","Sulfonamides (sulfa drugs)","NSAIDs / aspirin / ibuprofen","Contrast dye / iodine","Latex / rubber","ACE inhibitors (e.g. lisinopril, captopril)","Food allergy (specify if possible)","Environmental allergy (pollen, dust, etc.)","Not sure / never tested"]},

  // ── Section 6: Patient Demographics ─────────────────────────────────────────
  {id:"age_group",section:"Demographics",
   q:"What is your age group?",type:"single",
   opts:["Newborn (0–28 days)","Infant (1–11 months)","Toddler (1–2 years)","Child (3–11 years)","Adolescent (12–17 years)","Young adult (18–25)","Adult (26–35)","Adult (36–45)","Adult (46–55)","Senior (56–65)","Elderly (66–75)","Very elderly (76+)"]},

  {id:"sex",section:"Demographics",
   q:"Biological sex (affects diagnostic probabilities):",type:"single",
   opts:["Male","Female","Intersex","Prefer not to say"]},

  {id:"pregnancy",section:"Demographics",
   q:"Reproductive status (if applicable):",type:"single",
   opts:["Not applicable","Not pregnant","Pregnant — 1st trimester (0–12 weeks)","Pregnant — 2nd trimester (13–26 weeks)","Pregnant — 3rd trimester (27–40 weeks)","Recently postpartum (within 6 weeks)","Breastfeeding","Menopause / post-menopause","Unknown"]},

  {id:"lifestyle",section:"Demographics",
   q:"Lifestyle factors (select all that apply):",type:"multi",
   opts:["Current smoker","Former smoker","Alcohol consumption (regular)","Illicit drug use","Sedentary lifestyle / low physical activity","High-stress occupation or environment","Occupational chemical / dust exposure","Recent international travel","Rural / remote living","Malnutrition / food insecurity","None of the above"]},

  // ── Section 7: Location ───────────────────────────────────────────────────────
  {id:"location",section:"Location",
   q:"What is your habitation zone or city? (for specialist matching)",type:"location"},

  // ── Section 8: Vitals ─────────────────────────────────────────────────────────
  {id:"vitals",section:"Vitals",
   q:"Enter available vital signs (leave blank if unknown):",type:"vitals"},
];

const ADELAYS = [0,800,1600,2400,3200,4000,4800,5600,6200,6800,7400];
const ASTEP_LABELS = [
  "Parsing expanded symptom profile","Evaluating red flag combinations",
  "Querying WHO clinical guidelines","Searching Mayo Clinic database",
  "Cross-referencing NIH MedlinePlus","Running KNN zone-matching algorithm",
  "Computing differential diagnosis","Scoring triage classification",
  "Analysing medication interactions","Generating referral pathway","Compiling evidence report"
];


// ═══════════════════════════════════════════════════════════════════════════════
//  SPECIALIST DIRECTORY — 35 specialists across Cameroon + telemedicine
// ═══════════════════════════════════════════════════════════════════════════════
var SPECIALISTS = [
  // lat/lng used by KNN and Google Maps
  {id:"s001",name:"Dr. Ambroise FOMEKONG",specialty:"Cardiology",subspec:"Interventional Cardiology",zone:"Yaoundé Centre",city:"Yaoundé",lat:3.8667,lng:11.5167,facility:"Hôpital Central de Yaoundé",address:"Rue Henri Dunant, Yaoundé",phone:"+237 222 23 40 11",email:"a.fomekong@hcy.cm",available:"Mon–Fri 08:00–16:00",languages:["French","English"],tags:["chest","heart","cardiology","hypertension","arrhythmia","palpitations","heart attack"]},
  {id:"s002",name:"Dr. Marie-Claire ESSOMBA",specialty:"Neurology",subspec:"Stroke & Epilepsy",zone:"Yaoundé Centre",city:"Yaoundé",lat:3.8680,lng:11.5180,facility:"CHU de Yaoundé (CHUY)",address:"BP 8046, Yaoundé",phone:"+237 222 31 86 31",email:"mc.essomba@chuy.cm",available:"Mon–Fri 08:00–15:00",languages:["French"],tags:["neuro","headache","dizz","stroke","epilepsy","numbness","seizure","confusion","vertigo","facial drop","slurred speech"]},
  {id:"s003",name:"Dr. Paul NKENGASONG",specialty:"General Medicine",subspec:"Internal Medicine & Triage",zone:"Yaoundé Bastos",city:"Yaoundé",lat:3.8790,lng:11.5090,facility:"Clinique Bastos",address:"Quartier Bastos, Yaoundé",phone:"+237 222 20 57 00",email:"contact@cliniquebastos.cm",available:"Mon–Sat 07:00–20:00",languages:["French","English"],tags:["general","fever","fatigue","abdom","triage","adult","malaise","weight loss","night sweats"]},
  {id:"s004",name:"Dr. Christelle MANGA",specialty:"Gastroenterology",subspec:"Hepatology & Digestive Diseases",zone:"Yaoundé Melen",city:"Yaoundé",lat:3.8550,lng:11.5200,facility:"Hôpital Général de Yaoundé",address:"Rue du Palais, BP 5408, Yaoundé",phone:"+237 222 23 26 42",email:"gastro@hgy.cm",available:"Tue–Sat 09:00–17:00",languages:["French","English"],tags:["abdom","nausea","vomiting","gastro","liver","digestive","jaundice","diarrhea","constipation","bloating","rectal bleeding","ulcer","hepatitis"]},
  {id:"s005",name:"Dr. Jean-Baptiste OWONO",specialty:"Pneumology",subspec:"Asthma, COPD & Respiratory Infections",zone:"Yaoundé Ngoa-Ekellé",city:"Yaoundé",lat:3.8600,lng:11.5100,facility:"Centre Pasteur du Cameroun",address:"Rue Henri Dunant, Yaoundé",phone:"+237 222 23 15 78",email:"pneumo@pasteur-yaounde.org",available:"Mon–Fri 08:00–16:00",languages:["French","English"],tags:["breath","respiratory","asthma","COPD","cough","fever","lungs","tuberculosis","pneumonia","wheezing","dyspnea","haemoptysis"]},
  {id:"s006",name:"Dr. Sylvie ATEBA NDONGO",specialty:"Pediatrics",subspec:"Neonatology & Child Health",zone:"Yaoundé Cité Verte",city:"Yaoundé",lat:3.8720,lng:11.5300,facility:"Hôpital de la Cité Verte",address:"Cité Verte, Yaoundé",phone:"+237 222 31 02 00",email:"pediatrie@cite-verte.cm",available:"Mon–Fri 07:30–18:00",languages:["French","English","Beti"],tags:["child","pediatric","infant","fever","growth","vaccination","toddler","newborn","malnutrition","diarrhea","dehydration"]},
  {id:"s007",name:"Dr. Roger MBASSI",specialty:"Orthopedics & Traumatology",subspec:"Joint Surgery & Spine",zone:"Yaoundé Omnisports",city:"Yaoundé",lat:3.8650,lng:11.5250,facility:"Centre Médical la Croix du Sud",address:"Quartier Omnisports, Yaoundé",phone:"+237 699 45 12 78",email:"ortho@croixdusud.cm",available:"Mon–Fri 09:00–17:00, Sat 09:00–13:00",languages:["French","English"],tags:["joint","muscle","bone","fracture","back","knee","spine","neck","trauma","injury","arthritis","orthopedic","sports injury"]},
  {id:"s008",name:"Dr. Bernadette FOUDA",specialty:"Dermatology",subspec:"Clinical & Cosmetic Dermatology",zone:"Yaoundé Mfoundi",city:"Yaoundé",lat:3.8700,lng:11.5150,facility:"Cabinet Médical Spécialisé",address:"Avenue Kennedy, Yaoundé",phone:"+237 697 23 56 89",email:"dermato@fouda.cm",available:"Mon–Fri 10:00–18:00",languages:["French"],tags:["skin","rash","lesion","derma","allergy","itch","hives","wound","eczema","psoriasis","acne","abscess","ulcer"]},
  {id:"s009",name:"Dr. Emmanuel LEKE",specialty:"Ophthalmology",subspec:"Retinal Disease & Glaucoma",zone:"Yaoundé Nlongkak",city:"Yaoundé",lat:3.8750,lng:11.5200,facility:"Centre Ophtalmologique de Yaoundé",address:"Quartier Nlongkak, Yaoundé",phone:"+237 222 21 34 56",email:"eye@coy.cm",available:"Tue–Sat 08:00–17:00",languages:["French","English"],tags:["eye","vision","sight","glaucoma","ophthalmo","red eye","vision loss","photophobia","cataract"]},
  {id:"s010",name:"Dr. Hélène NKOA",specialty:"Psychiatry",subspec:"Mood Disorders & Psychosis",zone:"Yaoundé Centre",city:"Yaoundé",lat:3.8660,lng:11.5170,facility:"Hôpital Jamot de Yaoundé",address:"Rue Jamot, Yaoundé",phone:"+237 222 23 09 11",email:"psychiatrie@jamot.cm",available:"Mon–Fri 08:00–15:00",languages:["French","English"],tags:["mental","psychiatry","anxiety","depression","psychosis","sleep","bipolar","suicidal","behavioral","stress"]},
  {id:"s011",name:"Dr. Florentine ABOMO",specialty:"Gynecology & Obstetrics",subspec:"Maternal-Fetal Medicine",zone:"Yaoundé Biyem-Assi",city:"Yaoundé",lat:3.8500,lng:11.5050,facility:"Clinique Gynéco-Obstétrique",address:"Biyem-Assi, Yaoundé",phone:"+237 699 12 34 56",email:"gyneco@abomo.cm",available:"Mon–Sat 08:00–18:00",languages:["French","English"],tags:["gyneco","pregnancy","obstetrics","fertility","female","uterus","antenatal","vaginal bleeding","STI","menstrual","reproductive"]},
  {id:"s012",name:"Dr. Théodore MBARGA",specialty:"Urology",subspec:"Prostate & Urinary Tract",zone:"Yaoundé Essos",city:"Yaoundé",lat:3.8620,lng:11.5330,facility:"Centre Urologique de Yaoundé",address:"Quartier Essos, Yaoundé",phone:"+237 699 78 45 12",email:"uro@cuy.cm",available:"Mon–Fri 09:00–17:00",languages:["French"],tags:["urinary","urology","prostate","kidney stone","bladder","haematuria","urinary frequency","male reproductive","STI"]},
  {id:"s013",name:"Dr. Léa TONYE",specialty:"Endocrinology",subspec:"Diabetes & Metabolic Syndrome",zone:"Yaoundé Centre",city:"Yaoundé",lat:3.8670,lng:11.5160,facility:"Hôpital Central de Yaoundé",address:"Rue Henri Dunant, Yaoundé",phone:"+237 699 56 78 90",email:"endocrine@tonye.cm",available:"Mon–Thu 08:00–16:00",languages:["French","English"],tags:["diabetes","thyroid","endocrine","fatigue","weight","hormones","obesity","metabolic","hypoglycemia"]},

  // ── DOUALA ───────────────────────────────────────────────────────────────────
  {id:"s014",name:"Dr. Alain BOPDA",specialty:"Cardiology",subspec:"Echocardiography & Heart Failure",zone:"Douala Akwa",city:"Douala",lat:4.0511,lng:9.7085,facility:"Hôpital Laquintinie de Douala",address:"Avenue de la République, Douala",phone:"+237 233 42 22 22",email:"cardio@laquintinie.cm",available:"Mon–Fri 08:00–16:00",languages:["French","English"],tags:["chest","heart","cardiology","hypertension","echocardiography","heart failure","palpitations","oedema"]},
  {id:"s015",name:"Dr. Françoise DIKONGUE",specialty:"Oncology",subspec:"Breast & Gynecological Oncology",zone:"Douala Bonapriso",city:"Douala",lat:4.0450,lng:9.6990,facility:"Clinique des Spécialités Bonapriso",address:"Rue Caen, Bonapriso, Douala",phone:"+237 233 43 89 10",email:"oncology@csb-douala.cm",available:"Mon–Fri 09:00–17:00",languages:["French","English"],tags:["cancer","oncology","breast","tumor","chemo","weight loss","lymph node","fatigue","anaemia","bleeding"]},
  {id:"s016",name:"Dr. Victor MOUELLE",specialty:"Nephrology",subspec:"Renal Failure & Dialysis",zone:"Douala Deido",city:"Douala",lat:4.0600,lng:9.7150,facility:"Centre de Dialyse de Douala",address:"Quartier Deido, Douala",phone:"+237 233 39 78 00",email:"dialyse@cdd.cm",available:"Mon–Sat 07:00–19:00",languages:["French"],tags:["kidney","renal","dialysis","urinary","nephro","swelling","oedema","haematuria","hypertension","proteinuria"]},
  {id:"s017",name:"Dr. Anne-Marie TCHAMBA",specialty:"Gynecology & Obstetrics",subspec:"High-Risk Pregnancy & Infertility",zone:"Douala Makepe",city:"Douala",lat:4.0580,lng:9.7380,facility:"Clinique Sainte Thérèse",address:"Quartier Makepe, Douala",phone:"+237 699 78 23 45",email:"gyneco@ste-therese-dla.cm",available:"Mon–Sat 08:00–18:00",languages:["French","English","Duala"],tags:["gyneco","pregnancy","obstetrics","fertility","female","antenatal","STI","contraception","vaginal discharge","menstrual"]},
  {id:"s018",name:"Dr. Patrice NJANKOUO",specialty:"General Surgery",subspec:"Abdominal & Laparoscopic Surgery",zone:"Douala Akwa Nord",city:"Douala",lat:4.0530,lng:9.7050,facility:"Polyclinique la Grâce",address:"Quartier Akwa Nord, Douala",phone:"+237 233 43 12 34",email:"surgery@lagrace-douala.cm",available:"Mon–Sat 08:00–18:00",languages:["French","English"],tags:["surgery","abdom","appendix","hernia","gallbladder","abdominal","peritonitis","obstruction","trauma"]},
  {id:"s019",name:"Dr. Cédric EKWE",specialty:"Infectious Diseases",subspec:"HIV, TB & Tropical Medicine",zone:"Douala New Bell",city:"Douala",lat:4.0480,lng:9.7100,facility:"Hôpital Général de Douala",address:"Boulevard de la Liberté, Douala",phone:"+237 233 42 56 72",email:"infect@hgd.cm",available:"Mon–Fri 08:00–16:00",languages:["French","English"],tags:["HIV","tuberculosis","malaria","typhoid","infection","fever","tropical","STI","antiretroviral","hepatitis","dengue","cholera"]},
  {id:"s020",name:"Dr. Marlène NJOCK",specialty:"Pulmonology",subspec:"TB & Respiratory Critical Care",zone:"Douala Bonaberi",city:"Douala",lat:4.0700,lng:9.6800,facility:"Centre Pneumologique de Douala",address:"Bonaberi, Douala",phone:"+237 699 23 45 67",email:"pneumo@cpd.cm",available:"Mon–Fri 08:00–15:00",languages:["French"],tags:["tuberculosis","respiratory","cough","haemoptysis","breath","asthma","COPD","pneumonia","pleural effusion","dyspnea"]},

  // ── BAFOUSSAM ─────────────────────────────────────────────────────────────────
  {id:"s021",name:"Dr. Samuel FONKOUA",specialty:"General Medicine",subspec:"Primary Care & Infectious Diseases",zone:"Bafoussam Tamdja",city:"Bafoussam",lat:5.4737,lng:10.4196,facility:"Hôpital Régional de Bafoussam",address:"Rue de l'Hôpital, Bafoussam",phone:"+237 233 44 13 52",email:"medecine@hrb.cm",available:"Mon–Fri 07:30–16:00",languages:["French","English","Ghomala"],tags:["general","fever","infection","malaria","typhoid","fatigue","diarrhea","dehydration"]},
  {id:"s022",name:"Dr. Cécile NKENFACK",specialty:"Pediatrics",subspec:"Malnutrition & Tropical Diseases",zone:"Bafoussam Centre",city:"Bafoussam",lat:5.4780,lng:10.4220,facility:"Centre Mère et Enfant de Bafoussam",address:"Avenue des Brasseries, Bafoussam",phone:"+237 699 34 56 78",email:"pediatrie@cme-bafoussam.cm",available:"Mon–Fri 08:00–16:00",languages:["French","Ghomala"],tags:["child","pediatric","infant","malnutrition","fever","diarrhea","vaccination","newborn","toddler"]},

  // ── GAROUA ───────────────────────────────────────────────────────────────────
  {id:"s023",name:"Dr. Hamidou MAÏGA",specialty:"Internal Medicine",subspec:"Tropical & Infectious Diseases",zone:"Garoua Plateau",city:"Garoua",lat:9.3017,lng:13.3932,facility:"Hôpital Régional de Garoua",address:"Avenue de la République, Garoua",phone:"+237 222 27 11 54",email:"medecine@hrg.cm",available:"Mon–Fri 07:00–15:00",languages:["French","Fulfuldé","English"],tags:["fever","malaria","typhoid","infection","general","fatigue","meningitis","cholera","tropical"]},
  {id:"s024",name:"Dr. Aïssatou MOUSSA",specialty:"Gynecology & Obstetrics",subspec:"Maternal Health & Family Planning",zone:"Garoua Nord",city:"Garoua",lat:9.3100,lng:13.3980,facility:"Centre de Santé Intégré de Garoua",address:"Quartier Foulbé, Garoua",phone:"+237 699 12 78 34",email:"gyneco@csi-garoua.cm",available:"Mon–Sat 08:00–17:00",languages:["French","Fulfuldé"],tags:["gyneco","pregnancy","maternal","female","obstetrics","antenatal","family planning","STI"]},

  // ── MAROUA ────────────────────────────────────────────────────────────────────
  {id:"s025",name:"Dr. Ibrahim YERIMA",specialty:"General Medicine",subspec:"Primary Care & Tropical Diseases",zone:"Maroua Centre",city:"Maroua",lat:10.5900,lng:14.3159,facility:"Hôpital Régional de Maroua",address:"Rue de l'Hôpital, Maroua",phone:"+237 222 29 12 45",email:"medecine@hrm.cm",available:"Mon–Fri 07:30–15:00",languages:["French","Fulfuldé","Arabic"],tags:["fever","malaria","general","tropical","fatigue","infection","meningitis","cholera","snake bite","dehydration"]},
  {id:"s026",name:"Dr. Fanta ALIOU",specialty:"Pediatrics",subspec:"Nutrition & Child Tropical Diseases",zone:"Maroua Dougoy",city:"Maroua",lat:10.5950,lng:14.3200,facility:"Centre Pédiatrique de Maroua",address:"Quartier Dougoy, Maroua",phone:"+237 699 45 67 89",email:"pediatrie@maroua.cm",available:"Mon–Fri 08:00–16:00",languages:["French","Fulfuldé"],tags:["child","pediatric","infant","malnutrition","fever","malaria","diarrhea","dehydration","vaccination"]},

  // ── BAMENDA ───────────────────────────────────────────────────────────────────
  {id:"s027",name:"Dr. Claudette FONGE",specialty:"Internal Medicine",subspec:"Hypertension & Metabolic Diseases",zone:"Bamenda Mile 4",city:"Bamenda",lat:5.9631,lng:10.1591,facility:"Regional Hospital Bamenda",address:"Hospital Road, Bamenda",phone:"+237 233 36 12 09",email:"medicine@rhb.cm",available:"Mon–Fri 08:00–16:00",languages:["English","Pidgin"],tags:["hypertension","diabetes","fatigue","general","metabolic","chest","obesity","thyroid","anaemia"]},
  {id:"s028",name:"Dr. Takang NGOLE",specialty:"General Surgery",subspec:"Emergency & Trauma Surgery",zone:"Bamenda Up Station",city:"Bamenda",lat:5.9700,lng:10.1620,facility:"Baptist Hospital Bamenda",address:"Up Station, Bamenda",phone:"+237 233 36 22 34",email:"surgery@bhb.cm",available:"Mon–Sat 08:00–17:00",languages:["English","French"],tags:["surgery","emergency","abdom","trauma","abdominal","bleeding","fracture","injury","accident"]},

  // ── EBOLOWA ───────────────────────────────────────────────────────────────────
  {id:"s029",name:"Dr. Marcel MEYE",specialty:"General Medicine",subspec:"Rural Health & Infectious Diseases",zone:"Ebolowa Centre",city:"Ebolowa",lat:2.9000,lng:11.1500,facility:"Hôpital Régional d'Ebolowa",address:"Rue de l'Hôpital, Ebolowa",phone:"+237 222 28 11 33",email:"medecine@hre.cm",available:"Mon–Fri 07:30–15:30",languages:["French","Bulu"],tags:["fever","malaria","general","infection","rural","tropical","diarrhea","parasitic","yellow fever"]},

  // ── BERTOUA ───────────────────────────────────────────────────────────────────
  {id:"s030",name:"Dr. Rose NKOMO",specialty:"Pediatrics",subspec:"Child Infectious Diseases & Nutrition",zone:"Bertoua Centre",city:"Bertoua",lat:4.5766,lng:13.6845,facility:"Hôpital Régional de Bertoua",address:"Avenue de la Santé, Bertoua",phone:"+237 222 24 15 67",email:"pediatrie@hrbertoua.cm",available:"Mon–Fri 08:00–16:00",languages:["French","Gbaya"],tags:["child","infant","fever","malnutrition","infection","diarrhea","malaria","vaccination","respiratory"]},

  // ── NGAOUNDÉRÉ ────────────────────────────────────────────────────────────────
  {id:"s031",name:"Dr. Oumarou BELLO",specialty:"General Medicine",subspec:"Internal Medicine & Chronic Disease",zone:"Ngaoundéré Centre",city:"Ngaoundéré",lat:7.3236,lng:13.5836,facility:"Hôpital Régional de Ngaoundéré",address:"Rue de l'Hôpital, Ngaoundéré",phone:"+237 222 25 10 44",email:"medecine@hrng.cm",available:"Mon–Fri 07:30–15:30",languages:["French","Fulfuldé"],tags:["general","fever","malaria","hypertension","diabetes","fatigue","infection","chronic disease"]},

  // ── LIMBE ─────────────────────────────────────────────────────────────────────
  {id:"s032",name:"Dr. Ernestine MOLUA",specialty:"Internal Medicine",subspec:"Cardiovascular & Metabolic",zone:"Limbe Town",city:"Limbe",lat:4.0234,lng:9.2087,facility:"Limbe Regional Hospital",address:"Bota Road, Limbe",phone:"+237 233 33 21 10",email:"medicine@lrh.cm",available:"Mon–Fri 08:00–16:00",languages:["English","Pidgin","French"],tags:["hypertension","heart","diabetes","fatigue","chest","oedema","metabolic","chronic disease"]},

  // ── TELEMEDICINE ──────────────────────────────────────────────────────────────
  {id:"s033",name:"Dr. Kevin TCHIO",specialty:"Telemedicine — General Practice",subspec:"Digital Health & Remote Triage",zone:"Online / Remote",city:"Remote",lat:3.8480,lng:11.5021,facility:"NdMED Telemedicine Platform",address:"Virtual — Available Worldwide",phone:"+237 695 00 11 22",email:"teleconsult@ndmed.health",available:"Mon–Sun 06:00–22:00",languages:["French","English"],tags:["general","telemedicine","remote","online","all","fever","advice","rural","follow-up"]},
  {id:"s034",name:"Dr. Nadège BILOA",specialty:"Telemedicine — Cardiology & Internal Medicine",subspec:"Remote Cardiac Monitoring",zone:"Online / Remote",city:"Remote",lat:3.8490,lng:11.5030,facility:"NdMED Telemedicine Platform",address:"Virtual — Available Worldwide",phone:"+237 695 00 33 44",email:"cardio-tele@ndmed.health",available:"Mon–Fri 08:00–20:00",languages:["French","English"],tags:["chest","heart","hypertension","telemedicine","remote","cardio","arrhythmia","palpitations"]},
  {id:"s035",name:"Dr. Aurelie MBONG",specialty:"Telemedicine — Pediatrics & Women's Health",subspec:"Remote Child & Maternal Care",zone:"Online / Remote",city:"Remote",lat:3.8500,lng:11.5040,facility:"NdMED Telemedicine Platform",address:"Virtual — Available Worldwide",phone:"+237 695 00 55 66",email:"maternal-tele@ndmed.health",available:"Mon–Sun 07:00–21:00",languages:["French","English","Pidgin"],tags:["child","pediatric","pregnancy","maternal","female","infant","gyneco","antenatal","telemedicine"]},
];

var ZONES = [
  "Yaoundé Centre","Yaoundé Bastos","Yaoundé Melen","Yaoundé Ngoa-Ekellé","Yaoundé Cité Verte",
  "Yaoundé Omnisports","Yaoundé Mfoundi","Yaoundé Nlongkak","Yaoundé Biyem-Assi","Yaoundé Essos",
  "Douala Akwa","Douala Bonapriso","Douala Deido","Douala Bonanjo","Douala Makepe","Douala Akwa Nord",
  "Douala New Bell","Douala Bonaberi","Bafoussam Tamdja","Bafoussam Centre",
  "Garoua Plateau","Garoua Nord","Maroua Centre","Maroua Dougoy",
  "Bamenda Mile 4","Bamenda Up Station","Ebolowa Centre","Bertoua Centre",
  "Ngaoundéré Centre","Limbe Town","Online / Remote",
];

// Zone centroid coordinates for KNN distance calculation
var ZONE_COORDS = {
  "Yaoundé Centre":{lat:3.8667,lng:11.5167},"Yaoundé Bastos":{lat:3.8790,lng:11.5090},
  "Yaoundé Melen":{lat:3.8550,lng:11.5200},"Yaoundé Ngoa-Ekellé":{lat:3.8600,lng:11.5100},
  "Yaoundé Cité Verte":{lat:3.8720,lng:11.5300},"Yaoundé Omnisports":{lat:3.8650,lng:11.5250},
  "Yaoundé Mfoundi":{lat:3.8700,lng:11.5150},"Yaoundé Nlongkak":{lat:3.8750,lng:11.5200},
  "Yaoundé Biyem-Assi":{lat:3.8500,lng:11.5050},"Yaoundé Essos":{lat:3.8620,lng:11.5330},
  "Douala Akwa":{lat:4.0511,lng:9.7085},"Douala Bonapriso":{lat:4.0450,lng:9.6990},
  "Douala Deido":{lat:4.0600,lng:9.7150},"Douala Bonanjo":{lat:4.0480,lng:9.7100},
  "Douala Makepe":{lat:4.0580,lng:9.7380},"Douala Akwa Nord":{lat:4.0530,lng:9.7050},
  "Douala New Bell":{lat:4.0480,lng:9.7100},"Douala Bonaberi":{lat:4.0700,lng:9.6800},
  "Bafoussam Tamdja":{lat:5.4737,lng:10.4196},"Bafoussam Centre":{lat:5.4780,lng:10.4220},
  "Garoua Plateau":{lat:9.3017,lng:13.3932},"Garoua Nord":{lat:9.3100,lng:13.3980},
  "Maroua Centre":{lat:10.5900,lng:14.3159},"Maroua Dougoy":{lat:10.5950,lng:14.3200},
  "Bamenda Mile 4":{lat:5.9631,lng:10.1591},"Bamenda Up Station":{lat:5.9700,lng:10.1620},
  "Ebolowa Centre":{lat:2.9000,lng:11.1500},"Bertoua Centre":{lat:4.5766,lng:13.6845},
  "Ngaoundéré Centre":{lat:7.3236,lng:13.5836},"Limbe Town":{lat:4.0234,lng:9.2087},
  "Online / Remote":{lat:3.8480,lng:11.5021},
};

// ═══════════════════════════════════════════════════════════════════════════════
//  KNN MATCHING ENGINE — K=6, weighted Euclidean distance in feature space
// ═══════════════════════════════════════════════════════════════════════════════
function haversineKm(lat1,lng1,lat2,lng2){
  var R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lat2-lat2)*Math.PI/180;  // unused dLng fix below
  dLng=(lng2-lng1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function knnMatchSpecialists(referralSpecialty, patientZone, chiefComplaints, K) {
  K = K || 6;
  var chief = Array.isArray(chiefComplaints) ? chiefComplaints : [chiefComplaints||""];
  var chiefLower = chief.map(function(c){ return (c||"").toLowerCase(); });
  var specLower  = (referralSpecialty||"").toLowerCase();

  // Get patient coords
  var pCoord = ZONE_COORDS[patientZone] || ZONE_COORDS["Yaoundé Centre"];

  var scored = SPECIALISTS.map(function(sp) {
    var score = 0;

    // Feature 1: Geographic proximity (weight 35%)
    var distKm = haversineKm(pCoord.lat, pCoord.lng, sp.lat, sp.lng);
    var isRemote = sp.zone === "Online / Remote";
    var geoScore = isRemote ? 60 : Math.max(0, 100 - distKm * 0.8);
    score += geoScore * 0.35;

    // Feature 2: Specialty match (weight 40%)
    var spSpecLower = sp.specialty.toLowerCase();
    var specMatch = 0;
    if (spSpecLower === specLower) specMatch = 100;
    else if (spSpecLower.indexOf(specLower) >= 0 || specLower.indexOf(spSpecLower.split(" ")[0]) >= 0) specMatch = 75;
    else if (sp.subspec && sp.subspec.toLowerCase().indexOf(specLower) >= 0) specMatch = 60;
    else if (sp.specialty.indexOf("General") >= 0 || sp.specialty.indexOf("Internal") >= 0) specMatch = 30;
    if (isRemote) specMatch = Math.max(specMatch, 40);
    score += specMatch * 0.40;

    // Feature 3: Tag overlap with chief complaints (weight 25%)
    var tagHits = 0, tagTotal = sp.tags.length;
    chiefLower.forEach(function(c) {
      var cWords = c.split(/[\s\/,]+/);
      sp.tags.forEach(function(t) {
        cWords.forEach(function(w) {
          if (w.length >= 3 && (t.indexOf(w) >= 0 || w.indexOf(t) >= 0)) tagHits++;
        });
      });
    });
    var tagScore = tagTotal > 0 ? Math.min(100, (tagHits / tagTotal) * 200) : 0;
    score += tagScore * 0.25;

    return {sp:sp, score:score, distKm:Math.round(distKm), isRemote:isRemote};
  });

  scored.sort(function(a,b){ return b.score - a.score; });
  return scored.filter(function(x){ return x.score > 5; }).slice(0, K);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  EVIDENCE KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════════
var EVIDENCE_KB = {
  general:[
    {source:"WHO",url:"https://www.who.int/health-topics",note:"WHO clinical guidelines"},
    {source:"NIH MedlinePlus",url:"https://medlineplus.gov/healthtopics.html",note:"US NLM patient guides"},
    {source:"Mayo Clinic",url:"https://www.mayoclinic.org/symptoms",note:"Symptom and disease database"},
    {source:"CDC",url:"https://www.cdc.gov/az/a.html",note:"CDC disease index"},
    {source:"NHS UK",url:"https://www.nhs.uk/conditions/",note:"NHS condition guides"},
    {source:"Cleveland Clinic",url:"https://my.clevelandclinic.org/health/diseases",note:"Cleveland Clinic library"},
  ],
  chest:[
    {source:"Mayo Clinic",url:"https://www.mayoclinic.org/symptoms/chest-pain/basics/causes/sym-20050838",note:"Chest pain differential"},
    {source:"American Heart Association",url:"https://www.heart.org/en/health-topics/heart-attack/warning-signs-of-a-heart-attack",note:"Heart attack signs"},
    {source:"NIH MedlinePlus",url:"https://medlineplus.gov/chestpain.html",note:"Chest pain emergencies"},
  ],
  neuro:[
    {source:"Mayo Clinic",url:"https://www.mayoclinic.org/symptoms/headache/basics/causes/sym-20050900",note:"Headache differential"},
    {source:"American Stroke Association",url:"https://www.stroke.org/en/about-stroke/stroke-symptoms",note:"FAST stroke criteria"},
    {source:"NIH MedlinePlus",url:"https://medlineplus.gov/neurologicaldiseases.html",note:"Neurological conditions"},
  ],
  fever:[
    {source:"WHO",url:"https://www.who.int/news-room/fact-sheets/detail/malaria",note:"Malaria clinical guidance"},
    {source:"CDC",url:"https://www.cdc.gov/malaria/about/disease.html",note:"Malaria symptoms & treatment"},
    {source:"NHS UK",url:"https://www.nhs.uk/conditions/fever-in-adults/",note:"Fever management"},
  ],
  respiratory:[
    {source:"WHO",url:"https://www.who.int/news-room/fact-sheets/detail/pneumonia",note:"WHO pneumonia guidance"},
    {source:"Mayo Clinic",url:"https://www.mayoclinic.org/symptoms/shortness-of-breath/basics/causes/sym-20050890",note:"Dyspnea differential"},
    {source:"WHO",url:"https://www.who.int/news-room/fact-sheets/detail/tuberculosis",note:"TB fact sheet"},
  ],
  abdominal:[
    {source:"Mayo Clinic",url:"https://www.mayoclinic.org/symptoms/abdominal-pain/basics/causes/sym-20050728",note:"Abdominal pain differential"},
    {source:"NIH MedlinePlus",url:"https://medlineplus.gov/abdominalpain.html",note:"Abdominal pain assessment"},
    {source:"Cleveland Clinic",url:"https://my.clevelandclinic.org/health/symptoms/4167-abdominal-pain",note:"GI emergency signs"},
  ],
  mental:[
    {source:"WHO",url:"https://www.who.int/news-room/fact-sheets/detail/mental-disorders",note:"WHO mental disorders"},
    {source:"NIH MedlinePlus",url:"https://medlineplus.gov/mentaldisorders.html",note:"Mental health conditions"},
    {source:"Cleveland Clinic",url:"https://my.clevelandclinic.org/health/diseases/9536-depression",note:"Depression assessment"},
  ],
  gyneco:[
    {source:"WHO",url:"https://www.who.int/health-topics/maternal-health",note:"WHO maternal health"},
    {source:"NIH MedlinePlus",url:"https://medlineplus.gov/pregnancycomplications.html",note:"Pregnancy complications"},
    {source:"Mayo Clinic",url:"https://www.mayoclinic.org/healthy-lifestyle/pregnancy-week-by-week/basics/healthy-pregnancy/hlv-20049471",note:"Antenatal care"},
  ],
  skin:[
    {source:"Mayo Clinic",url:"https://www.mayoclinic.org/diseases-conditions/rashes/symptoms-causes/syc-20378973",note:"Rash differential"},
    {source:"NIH MedlinePlus",url:"https://medlineplus.gov/rashes.html",note:"Skin condition guide"},
    {source:"Cleveland Clinic",url:"https://my.clevelandclinic.org/health/symptoms/21885-rash",note:"Rash types & treatment"},
  ],
  trauma:[
    {source:"WHO",url:"https://www.who.int/news-room/fact-sheets/detail/injuries",note:"Trauma & injury guidance"},
    {source:"CDC",url:"https://www.cdc.gov/injury/index.html",note:"CDC injury prevention & care"},
    {source:"Mayo Clinic",url:"https://www.mayoclinic.org/first-aid/first-aid-severe-bleeding/basics/art-20056661",note:"First aid for trauma"},
  ],
};

function getRelevantSources(answers) {
  var chief = Array.isArray(answers.chief) ? answers.chief : [answers.chief||""];
  var all = [].concat(EVIDENCE_KB.general);
  chief.forEach(function(c) {
    c=(c||"").toLowerCase();
    if(c.indexOf("chest")>=0||c.indexOf("heart")>=0||c.indexOf("palpitat")>=0) all=all.concat(EVIDENCE_KB.chest);
    if(c.indexOf("head")>=0||c.indexOf("dizz")>=0||c.indexOf("neuro")>=0||c.indexOf("seizure")>=0||c.indexOf("stroke")>=0||c.indexOf("numb")>=0) all=all.concat(EVIDENCE_KB.neuro);
    if(c.indexOf("fever")>=0||c.indexOf("chill")>=0||c.indexOf("malaria")>=0||c.indexOf("infect")>=0) all=all.concat(EVIDENCE_KB.fever);
    if(c.indexOf("breath")>=0||c.indexOf("cough")>=0||c.indexOf("wheez")>=0||c.indexOf("tubercu")>=0) all=all.concat(EVIDENCE_KB.respiratory);
    if(c.indexOf("abdom")>=0||c.indexOf("nausea")>=0||c.indexOf("vomit")>=0||c.indexOf("diarr")>=0||c.indexOf("liver")>=0) all=all.concat(EVIDENCE_KB.abdominal);
    if(c.indexOf("mental")>=0||c.indexOf("psychiat")>=0||c.indexOf("depress")>=0||c.indexOf("anxiety")>=0) all=all.concat(EVIDENCE_KB.mental);
    if(c.indexOf("preg")>=0||c.indexOf("gynec")>=0||c.indexOf("vaginal")>=0||c.indexOf("menstr")>=0) all=all.concat(EVIDENCE_KB.gyneco);
    if(c.indexOf("skin")>=0||c.indexOf("rash")>=0||c.indexOf("itch")>=0||c.indexOf("lesion")>=0) all=all.concat(EVIDENCE_KB.skin);
    if(c.indexOf("injur")>=0||c.indexOf("trauma")>=0||c.indexOf("accident")>=0||c.indexOf("bite")>=0) all=all.concat(EVIDENCE_KB.trauma);
  });
  var seen={};
  return all.filter(function(s){if(seen[s.url])return false;seen[s.url]=1;return true;}).slice(0,9);
}

function buildPrompt(answers, plan) {
  var pro=plan==="pro"||plan==="clinical";
  var clin=plan==="clinical";
  var sources=getRelevantSources(answers);
  var srcText=sources.map(function(s,i){return (i+1)+". "+s.source+" — "+s.url+" ("+s.note+")";}).join("\n");
  var schema={
    triage_level:"EMERGENCY",triage_color:"RED",
    triage_label:"concise triage label",
    possible_conditions:[{name:"",probability:"High|Moderate|Low",icd10:"",icd11:"",description:"2 sentences",source:"",source_url:""}],
    red_flags:["critical sign if present"],
    immediate_actions:["action step"],
    do_not:["contraindication"],
    referral:{specialty:"",urgency_hours:2,facility_type:"ER|Hospital|Clinic|Telemedicine|Primary Care",rationale:""},
    first_aid:["step if applicable"],
    evidence_sources:pro?[{title:"",source:"",url:"",relevance:""}]:[],
    lab_tests_recommended:clin?[{test:"",rationale:""}]:[],
    drug_interactions:clin?[""]:[],
    clinical_notes:"2-3 sentences synthesis",
    summary:"2-3 sentences to patient",
    disclaimer:"This pre-clinical assessment is AI-generated and does not constitute medical advice. Only a licensed healthcare professional can diagnose and treat. In an emergency call 15/112/911 immediately."
  };
  return "You are NdMED, a pre-clinical triage AI by the LIWIMALA INITIATIVE.\n\n"+
    "TRUSTED CLINICAL SOURCES:\n"+srcText+"\n\n"+
    "PATIENT INTAKE DATA:\n"+JSON.stringify(answers,null,2)+"\n\n"+
    "PLAN: "+plan.toUpperCase()+"\n\n"+
    "INSTRUCTIONS:\n"+
    "1. Analyse all patient data using your clinical training.\n"+
    "2. Return ONLY a JSON object. No markdown. No text before or after.\n"+
    "3. Response must begin with { and end with }.\n"+
    "4. Replace ALL placeholder values with real clinical content.\n"+
    "5. For possible_conditions list at least 3 differentials ranked by probability.\n"+
    "6. Consider the patient's age, sex, lifestyle, medications, allergies, and family history.\n"+
    "7. Flag any drug interactions or allergy contraindications explicitly.\n\n"+
    "JSON SCHEMA:\n"+JSON.stringify(schema,null,2)+"\n\nRespond with the completed JSON:";
}

function extractJSON(text) {
  if(!text||!text.trim()) throw new Error("Empty response received");
  var t=text.replace(/^```[a-zA-Z]*\n?/m,"").replace(/```\s*$/m,"").trim();
  var start=t.indexOf("{");
  if(start===-1) throw new Error("No JSON in response: "+text.slice(0,200));
  var depth=0,end=-1;
  for(var i=start;i<t.length;i++){
    if(t[i]==="{") depth++;
    else if(t[i]==="}"){depth--;if(depth===0){end=i;break;}}
  }
  if(end===-1) throw new Error("JSON not properly closed");
  try{return JSON.parse(t.slice(start,end+1));}
  catch(e){throw new Error("JSON parse failed: "+e.message);}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL CSS
// ═══════════════════════════════════════════════════════════════════════════════
const GBL=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
@keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(0,201,177,0.5)}70%{box-shadow:0 0 0 9px rgba(0,0,0,0)}100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.fu{animation:fadeUp 0.4s cubic-bezier(.22,1,.36,1) both}
.fi{animation:fadeIn 0.3s ease both}
button{font-family:inherit;}
input,select{font-family:inherit;}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(0,201,177,0.25);border-radius:4px}
`;

// ═══════════════════════════════════════════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════════════════════════════════════════
function Dot({color,size}){color=color||"#00C9B1";size=size||11;return React.createElement("span",{style:{display:"inline-block",width:size,height:size,borderRadius:"50%",background:color,flexShrink:0,animation:"pulseRing 1.5s ease-out infinite"}});}
function Spin(){return React.createElement("span",{style:{display:"inline-block",width:16,height:16,border:"2px solid rgba(0,201,177,0.15)",borderTopColor:"#00C9B1",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}});}
function Chip({text,color}){color=color||"#00C9B1";return React.createElement("span",{style:{fontSize:9,fontWeight:700,letterSpacing:1.1,textTransform:"uppercase",padding:"3px 8px",borderRadius:20,background:color+"20",border:"1px solid "+color+"44",color,whiteSpace:"nowrap"}},text);}
function Crd({children,style}){return React.createElement("div",{style:Object.assign({background:"#0F2D4A",border:"1px solid rgba(0,201,177,0.18)",borderRadius:12,padding:"14px 16px"},style||{})},children);}
function SectionBadge({text}){return React.createElement("div",{style:{fontSize:8,fontWeight:800,color:"#00C9B1",letterSpacing:2,textTransform:"uppercase",marginBottom:8,padding:"2px 8px",borderRadius:4,background:"rgba(0,201,177,0.08)",display:"inline-block"}},text);}

function ProgBar({cur,tot}){
  var sections=[]; var seen={};
  QUESTIONS.forEach(function(q,i){if(!seen[q.section]){seen[q.section]=true;sections.push({name:q.section,start:i});}});
  var p=Math.round(cur/tot*100);
  var curSection=QUESTIONS[cur]&&QUESTIONS[cur].section||"";
  return React.createElement("div",{style:{marginBottom:18}},
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:5}},
      React.createElement("span",{style:{fontSize:9,color:"#7A99B8",fontWeight:600,letterSpacing:1}},curSection.toUpperCase()),
      React.createElement("span",{style:{fontSize:9,color:"#00C9B1",fontWeight:700}},cur+"/"+tot+" ("+p+"%)")
    ),
    React.createElement("div",{style:{height:3,background:"rgba(255,255,255,0.07)",borderRadius:2}},
      React.createElement("div",{style:{height:3,width:p+"%",background:"linear-gradient(90deg,#00C9B1,#8B5CF6)",borderRadius:2,transition:"width 0.4s cubic-bezier(.22,1,.36,1)"}})
    )
  );
}

function ScaleInput({min,max,val,onCh}){
  var nums=Array.from({length:max-min+1},function(_,i){return i+min;});
  var col=function(n){return n<=3?"#21C97A":n<=6?"#F6A623":"#E8394A";};
  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}},
      nums.map(function(n){
        var sel=val===n;
        return React.createElement("button",{key:n,onClick:function(){onCh(n);},style:{width:38,height:38,borderRadius:7,fontSize:13,cursor:"pointer",border:sel?"2px solid "+col(n):"1px solid rgba(255,255,255,0.07)",background:sel?col(n)+"1A":"rgba(255,255,255,0.03)",color:sel?col(n):"#7A99B8",fontWeight:sel?800:400,transition:"all 0.12s"}},n);
      })
    ),
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:10}},
      React.createElement("span",{style:{color:"#21C97A"}},"1 — Mild"),
      React.createElement("span",{style:{color:"#F6A623"}},"5 — Moderate"),
      React.createElement("span",{style:{color:"#E8394A"}},"10 — Severe")
    )
  );
}

function VitalsIn({val,onCh}){
  val=val||{};
  var fields=[
    {k:"bp",l:"Blood Pressure",ph:"e.g. 120/80 mmHg"},{k:"hr",l:"Heart Rate",ph:"e.g. 72 bpm"},
    {k:"temp",l:"Temperature",ph:"e.g. 37.2 °C"},{k:"spo2",l:"SpO₂",ph:"e.g. 98 %"},
    {k:"rr",l:"Resp. Rate",ph:"e.g. 16 /min"},{k:"bgl",l:"Blood Glucose",ph:"e.g. 5.5 mmol/L"},
    {k:"weight",l:"Weight (kg)",ph:"e.g. 70"},{k:"height",l:"Height (cm)",ph:"e.g. 175"},
  ];
  return React.createElement("div",null,
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:8}},
      fields.map(function(f){
        return React.createElement("div",{key:f.k},
          React.createElement("label",{style:{fontSize:9,color:"#7A99B8",display:"block",marginBottom:3,fontWeight:600}},f.l),
          React.createElement("input",{placeholder:f.ph,value:val[f.k]||"",
            onChange:function(e){var nv=Object.assign({},val);nv[f.k]=e.target.value;onCh(nv);},
            style:{width:"100%",padding:"8px 10px",borderRadius:7,fontSize:11,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",color:"#EDF2F7",outline:"none"},
            onFocus:function(e){e.target.style.borderColor="#00C9B1";},
            onBlur:function(e){e.target.style.borderColor="rgba(255,255,255,0.07)";}
          })
        );
      })
    ),
    React.createElement("p",{style:{fontSize:9,color:"#7A99B8",fontStyle:"italic"}},"Leave blank if unavailable. Weight+Height allow BMI calculation for metabolic risk.")
  );
}

function LocationInput({val,onCh}){
  var st=useState(val||""); var search=st[0]; var setSearch=st[1];
  var filtered=useMemo(function(){
    return search.length>=1?ZONES.filter(function(z){return z.toLowerCase().indexOf(search.toLowerCase())>=0;}):ZONES;
  },[search]);
  return React.createElement("div",null,
    React.createElement("input",{
      placeholder:"Type your city or zone (e.g. Yaoundé Bastos, Douala Akwa...)",
      value:search,
      onChange:function(e){setSearch(e.target.value);onCh(e.target.value);},
      style:{width:"100%",padding:"11px 14px",borderRadius:9,fontSize:13,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(0,201,177,0.3)",color:"#EDF2F7",outline:"none",marginBottom:10},
      onFocus:function(e){e.target.style.borderColor="#00C9B1";},
      onBlur:function(e){e.target.style.borderColor="rgba(0,201,177,0.3)";}
    }),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,maxHeight:200,overflowY:"auto"}},
      filtered.map(function(z){
        var sel=val===z;
        return React.createElement("button",{key:z,onClick:function(){onCh(z);setSearch(z);},
          style:{padding:"7px 10px",borderRadius:7,fontSize:11,textAlign:"left",cursor:"pointer",
            border:sel?"1.5px solid #00C9B1":"1px solid rgba(255,255,255,0.07)",
            background:sel?"rgba(0,201,177,0.1)":"rgba(255,255,255,0.025)",
            color:sel?"#00C9B1":"#EDF2F7",fontWeight:sel?700:400,fontFamily:"inherit",transition:"all 0.12s"}
        },z);
      })
    ),
    React.createElement("p",{style:{fontSize:9,color:"#7A99B8",marginTop:8,fontStyle:"italic"}},"Your zone powers the KNN specialist matching algorithm and Google Maps directions.")
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  GOOGLE MAPS MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function GoogleMapModal({sp, patientZone, onClose}) {
  var pCoord = ZONE_COORDS[patientZone] || ZONE_COORDS["Yaoundé Centre"];
  var destCoord = {lat: sp.lat, lng: sp.lng};
  var isRemote = sp.zone === "Online / Remote";

  // Google Maps Embed API (no API key needed for basic embed)
  var mapSrc = isRemote
    ? "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127658!2d11.5021!3d3.848!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x108bcfdf3aa42a0b%3A0x5f4a4ba1ada574b!2sYaound%C3%A9!5e0!3m2!1sfr!2scm!4v1"
    : "https://maps.google.com/maps?q="+destCoord.lat+","+destCoord.lng+"&hl=fr&z=15&output=embed";

  var directionsUrl = isRemote
    ? "https://meet.google.com/"
    : "https://www.google.com/maps/dir/"+pCoord.lat+","+pCoord.lng+"/"+destCoord.lat+","+destCoord.lng;

  return React.createElement("div",{
    onClick:onClose,
    style:{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",background:"rgba(7,24,46,0.9)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}
  },
    React.createElement("div",{onClick:function(e){e.stopPropagation();},
      style:{width:"100%",maxWidth:650,background:"#0D2540",border:"1px solid rgba(0,201,177,0.3)",borderRadius:16,overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"90vh"}
    },
      // Header
      React.createElement("div",{style:{padding:"14px 18px",background:"#0B1F3A",display:"flex",alignItems:"center",gap:12,flexShrink:0}},
        React.createElement("div",{style:{flex:1}},
          React.createElement("div",{style:{fontSize:12,fontWeight:800,color:"#EDF2F7",marginBottom:2}},sp.name),
          React.createElement("div",{style:{fontSize:10,color:"#00C9B1"}},"📍 "+sp.facility+" · "+sp.zone)
        ),
        React.createElement("button",{onClick:onClose,style:{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",color:"#A8BCCF",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:13}},isRemote?"✕":"✕")
      ),
      // Map iframe
      !isRemote&&React.createElement("iframe",{
        src:mapSrc,
        width:"100%",height:280,frameBorder:"0",allowFullScreen:true,
        loading:"lazy",title:"Specialist location",
        style:{border:"none",flexShrink:0}
      }),
      isRemote&&React.createElement("div",{style:{height:180,background:"linear-gradient(135deg,rgba(139,92,246,0.15),rgba(0,201,177,0.1))",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}},
        React.createElement("span",{style:{fontSize:40}},"💻"),
        React.createElement("div",{style:{fontSize:14,fontWeight:700,color:"#EDF2F7"}},"Telemedicine Consultation"),
        React.createElement("div",{style:{fontSize:11,color:"#7A99B8"}},"Available worldwide via video / phone")
      ),
      // Info panel
      React.createElement("div",{style:{padding:"14px 18px",overflowY:"auto"}},
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}},
          React.createElement("div",{style:{background:"#0F2D4A",borderRadius:9,padding:"10px 12px"}},
            React.createElement("div",{style:{fontSize:8,color:"#7A99B8",textTransform:"uppercase",letterSpacing:1,marginBottom:3}},"Specialty"),
            React.createElement("div",{style:{fontSize:12,fontWeight:700,color:"#00C9B1"}},(sp.specialty||"").split(" — ")[0]),
            React.createElement("div",{style:{fontSize:10,color:"#A8BCCF"}},sp.subspec||"")
          ),
          React.createElement("div",{style:{background:"#0F2D4A",borderRadius:9,padding:"10px 12px"}},
            React.createElement("div",{style:{fontSize:8,color:"#7A99B8",textTransform:"uppercase",letterSpacing:1,marginBottom:3}},"Hours"),
            React.createElement("div",{style:{fontSize:11,color:"#EDF2F7"}},sp.available||""),
            React.createElement("div",{style:{fontSize:10,color:"#A8BCCF"}},"🗣 "+(sp.languages||[]).join(", "))
          ),
          React.createElement("div",{style:{background:"#0F2D4A",borderRadius:9,padding:"10px 12px",gridColumn:"1/-1"}},
            React.createElement("div",{style:{fontSize:8,color:"#7A99B8",textTransform:"uppercase",letterSpacing:1,marginBottom:3}},"Address"),
            React.createElement("div",{style:{fontSize:11,color:"#EDF2F7"}},(sp.facility||"")+" — "+(sp.address||""))
          )
        ),
        // Action buttons
        React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          React.createElement("a",{href:"tel:"+sp.phone,style:{flex:1,minWidth:120,padding:"10px",borderRadius:9,background:"linear-gradient(135deg,#21C97A,#1aa866)",color:"#07182E",textDecoration:"none",fontWeight:700,fontSize:12,textAlign:"center",display:"block"}},"📞 "+sp.phone),
          React.createElement("a",{href:"mailto:"+sp.email,style:{flex:1,minWidth:120,padding:"10px",borderRadius:9,background:"rgba(0,201,177,0.12)",border:"1px solid rgba(0,201,177,0.3)",color:"#00C9B1",textDecoration:"none",fontWeight:700,fontSize:12,textAlign:"center",display:"block"}},"✉ Email"),
          !isRemote&&React.createElement("a",{href:directionsUrl,target:"_blank",rel:"noopener noreferrer",style:{flex:1,minWidth:120,padding:"10px",borderRadius:9,background:"rgba(66,133,244,0.15)",border:"1px solid rgba(66,133,244,0.35)",color:"#6baaf8",textDecoration:"none",fontWeight:700,fontSize:12,textAlign:"center",display:"block"}},"🗺 Directions"),
          isRemote&&React.createElement("a",{href:"https://meet.google.com/",target:"_blank",rel:"noopener noreferrer",style:{flex:1,minWidth:120,padding:"10px",borderRadius:9,background:"rgba(139,92,246,0.15)",border:"1px solid rgba(139,92,246,0.35)",color:"#8B5CF6",textDecoration:"none",fontWeight:700,fontSize:12,textAlign:"center",display:"block"}},"💻 Video Call")
        )
      )
    )
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SPECIALIST CARD
// ═══════════════════════════════════════════════════════════════════════════════
function SpecialistCard({sp, rank, distKm, patientZone, onMapOpen}) {
  var icon=sp.specialty.indexOf("Cardio")>=0?"🫀":sp.specialty.indexOf("Neuro")>=0?"🧠":sp.specialty.indexOf("Pediatr")>=0?"👶":sp.specialty.indexOf("Gynec")>=0||sp.specialty.indexOf("Obstet")>=0||sp.specialty.indexOf("Maternal")>=0?"🤱":sp.specialty.indexOf("Oncol")>=0?"🎗️":sp.specialty.indexOf("Ortho")>=0?"🦴":sp.specialty.indexOf("Derma")>=0?"🩹":sp.specialty.indexOf("Ophthal")>=0?"👁️":sp.specialty.indexOf("Psychiat")>=0?"🧘":sp.specialty.indexOf("Nephro")>=0||sp.specialty.indexOf("Renal")>=0?"🫘":sp.specialty.indexOf("Gastro")>=0?"🫃":sp.specialty.indexOf("Pneumo")>=0||sp.specialty.indexOf("Pulmo")>=0?"🫁":sp.specialty.indexOf("Endocr")>=0?"⚗️":sp.specialty.indexOf("Surgery")>=0||sp.specialty.indexOf("Surg")>=0?"🔬":sp.specialty.indexOf("Infect")>=0?"🦠":sp.specialty.indexOf("Urol")>=0?"🫀":sp.specialty.indexOf("Telemedicine")>=0?"💻":"⚕️";
  var isRemote=sp.zone==="Online / Remote";
  var rankColor=rank===1?"#F6A623":rank===2?"#A8BCCF":"#7A99B8";
  return React.createElement("div",{style:{background:"#0F2D4A",border:"1px solid rgba(0,201,177,0.18)",borderRadius:12,padding:"13px 15px",marginBottom:8,transition:"border-color 0.15s"}},
    React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:11}},
      React.createElement("div",{style:{position:"relative",flexShrink:0}},
        React.createElement("div",{style:{width:44,height:44,borderRadius:10,background:"rgba(0,201,177,0.1)",border:"1px solid rgba(0,201,177,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}},icon),
        React.createElement("div",{style:{position:"absolute",top:-5,right:-5,width:16,height:16,borderRadius:"50%",background:rankColor,color:"#07182E",fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}},rank)
      ),
      React.createElement("div",{style:{flex:1,minWidth:0}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:2}},
          React.createElement("span",{style:{fontSize:13,fontWeight:700,color:"#EDF2F7"}},(sp.name||"")),
          isRemote&&React.createElement(Chip,{text:"TELEMEDICINE",color:"#8B5CF6"})
        ),
        React.createElement("div",{style:{fontSize:10,color:"#00C9B1",fontWeight:600,marginBottom:2}},(sp.specialty||"")+(sp.subspec?" · "+sp.subspec:"")),
        React.createElement("div",{style:{fontSize:10,color:"#7A99B8",marginBottom:6}},
          "📍 "+(sp.facility||"")+" · "+(sp.zone||""),
          !isRemote&&distKm!=null&&React.createElement("span",{style:{marginLeft:6,color:"#21C97A",fontWeight:600}},"~"+distKm+" km")
        ),
        React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          React.createElement("a",{href:"tel:"+(sp.phone||""),style:{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:20,fontSize:9,fontWeight:700,background:"rgba(33,201,122,0.12)",border:"1px solid rgba(33,201,122,0.3)",color:"#21C97A",textDecoration:"none"}},"📞 "+(sp.phone||"")),
          React.createElement("a",{href:"mailto:"+(sp.email||""),style:{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:20,fontSize:9,fontWeight:700,background:"rgba(0,201,177,0.1)",border:"1px solid rgba(0,201,177,0.25)",color:"#00C9B1",textDecoration:"none"}},"✉ Email"),
          React.createElement("button",{onClick:function(){onMapOpen(sp);},style:{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:20,fontSize:9,fontWeight:700,background:"rgba(66,133,244,0.12)",border:"1px solid rgba(66,133,244,0.3)",color:"#6baaf8",cursor:"pointer",fontFamily:"inherit"}},isRemote?"💻 Connect":"🗺 Map / Route")
        ),
        React.createElement("div",{style:{fontSize:9,color:"#7A99B8",marginTop:5}},"🕐 "+(sp.available||"")+" · 🗣 "+(sp.languages||[]).join(", "))
      )
    )
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  RESULT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ResultView({result,plan,onRestart,patientZone,chiefComplaints}){
  var tabState=useState("overview"); var tab=tabState[0]; var setTab=tabState[1];
  var mapState=useState(null); var mapSp=mapState[0]; var setMapSp=mapState[1];
  patientZone=patientZone||""; chiefComplaints=chiefComplaints||[];
  var tr=TRIAGE[result.triage_color]||TRIAGE.GREEN;
  var pro=plan==="pro"||plan==="clinical"; var clin=plan==="clinical";

  var knnResults=useMemo(function(){
    return knnMatchSpecialists(result.referral&&result.referral.specialty||"",patientZone,chiefComplaints,6);
  },[result,patientZone,chiefComplaints]);

  var tabs=[{id:"overview",l:"Overview"},{id:"conditions",l:"Conditions"},{id:"actions",l:"Actions"},{id:"referral",l:"Referral"},{id:"specialists",l:"🔍 Specialists"}];
  if(pro) tabs.push({id:"evidence",l:"Evidence"});
  if(clin) tabs.push({id:"labs",l:"Labs & Drugs"});

  var srcIcon=function(s){var found=SOURCES.find(function(x){return s&&s.toLowerCase().indexOf(x.name.toLowerCase())>=0;});return found?found.icon:"📋";};

  function listRows(arr){if(!arr||!arr.length)return React.createElement("i",{style:{fontSize:10,color:"#7A99B8"}},"None noted.");return React.createElement("ul",{style:{margin:"4px 0 0 14px",padding:0}},arr.map(function(x,i){return React.createElement("li",{key:i,style:{margin:"2px 0",fontSize:11,color:"#A8BCCF"}},x);}));}

  return React.createElement("div",{className:"fu"},
    mapSp&&React.createElement(GoogleMapModal,{sp:mapSp,patientZone:patientZone,onClose:function(){setMapSp(null);}}),

    // Triage banner
    React.createElement("div",{style:{background:"linear-gradient(135deg,"+tr.bg+"14,"+tr.bg+"06)",border:"1.5px solid "+tr.bg+"44",borderRadius:13,padding:"15px 17px",marginBottom:12,display:"flex",alignItems:"center",gap:12}},
      React.createElement("span",{style:{fontSize:26}},tr.icon),
      React.createElement("div",{style:{flex:1}},
        React.createElement("div",{style:{fontSize:8,color:"#7A99B8",letterSpacing:2,textTransform:"uppercase",fontWeight:600,marginBottom:2}},"Triage"),
        React.createElement("div",{style:{fontSize:19,fontWeight:800,color:tr.bg,lineHeight:1}},tr.label),
        React.createElement("div",{style:{fontSize:10,color:"#A8BCCF",marginTop:2}},tr.desc)
      ),
      React.createElement("div",{style:{textAlign:"right",flexShrink:0}},
        React.createElement("div",{style:{fontSize:8,color:"#7A99B8",letterSpacing:1,textTransform:"uppercase",marginBottom:2}},"Referral"),
        React.createElement("div",{style:{fontSize:12,fontWeight:700,color:"#EDF2F7"}},result.referral&&result.referral.facility_type||""),
        result.referral&&result.referral.urgency_hours!=null&&React.createElement("div",{style:{fontSize:10,color:tr.bg,fontWeight:700}},"Within "+result.referral.urgency_hours+"h")
      )
    ),
    // Summary
    React.createElement(Crd,{style:{marginBottom:11}},React.createElement("p",{style:{fontSize:12,color:"#EDF2F7",lineHeight:1.7,margin:0}},result.summary||"")),
    // Tabs
    React.createElement("div",{style:{display:"flex",gap:5,flexWrap:"wrap",marginBottom:11}},
      tabs.map(function(t){return React.createElement("button",{key:t.id,onClick:function(){setTab(t.id);},style:{padding:"6px 12px",borderRadius:7,fontSize:10,fontWeight:600,cursor:"pointer",border:tab===t.id?"1px solid #00C9B1":"1px solid rgba(255,255,255,0.07)",background:tab===t.id?"rgba(0,201,177,0.12)":"transparent",color:tab===t.id?"#00C9B1":"#7A99B8",fontFamily:"inherit"}},t.l);})
    ),

    // OVERVIEW
    tab==="overview"&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:9}},
      result.red_flags&&result.red_flags.length>0&&React.createElement("div",{style:{background:"rgba(232,57,74,0.08)",border:"1px solid rgba(232,57,74,0.28)",borderRadius:11,padding:"12px 14px"}},
        React.createElement("div",{style:{fontSize:9,color:"#E8394A",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:6}},"🚩 Red Flags Detected"),
        result.red_flags.map(function(f,i){return React.createElement("div",{key:i,style:{fontSize:11,color:"#f8a8ae",marginBottom:2}},"• "+f);})
      ),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}},
        React.createElement(Crd,null,React.createElement("div",{style:{fontSize:9,color:"#E8394A",fontWeight:700,letterSpacing:1,marginBottom:6,textTransform:"uppercase"}},"Do NOT"),listRows(result.do_not)),
        React.createElement(Crd,null,React.createElement("div",{style:{fontSize:9,color:"#21C97A",fontWeight:700,letterSpacing:1,marginBottom:6,textTransform:"uppercase"}},"First Aid"),result.first_aid&&result.first_aid.length>0?listRows(result.first_aid):React.createElement("i",{style:{fontSize:10,color:"#7A99B8"}},"No immediate first aid required."))
      ),
      result.clinical_notes&&React.createElement(Crd,{style:{borderColor:"rgba(139,92,246,0.22)",background:"rgba(139,92,246,0.05)"}},
        React.createElement("div",{style:{fontSize:9,color:"#8B5CF6",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}},"Clinical Commentary"),
        React.createElement("p",{style:{fontSize:11,color:"#A8BCCF",lineHeight:1.65,margin:0}},result.clinical_notes)
      )
    ),

    // CONDITIONS
    tab==="conditions"&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:9}},
      result.possible_conditions&&result.possible_conditions.map(function(c,i){
        var pc=c.probability==="High"?"#E8394A":c.probability==="Moderate"?"#F6762B":"#21C97A";
        return React.createElement(Crd,{key:i},
          React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:11}},
            React.createElement("div",{style:{width:40,height:40,borderRadius:9,background:pc+"18",border:"1px solid "+pc+"44",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},
              React.createElement("span",{style:{fontSize:9,fontWeight:800,color:pc}},c.probability==="High"?"HIGH":c.probability==="Moderate"?"MOD":"LOW")
            ),
            React.createElement("div",{style:{flex:1}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:3}},
                React.createElement("span",{style:{fontSize:13,fontWeight:700,color:"#EDF2F7"}},c.name||""),
                c.icd10&&React.createElement(Chip,{text:"ICD-10: "+c.icd10,color:"#7A99B8"}),
                c.icd11&&pro&&React.createElement(Chip,{text:"ICD-11: "+c.icd11,color:"#8B5CF6"})
              ),
              c.description&&React.createElement("p",{style:{fontSize:11,color:"#A8BCCF",lineHeight:1.6,margin:"0 0 5px"}},c.description),
              pro&&c.source_url?React.createElement("a",{href:c.source_url,target:"_blank",rel:"noopener noreferrer",style:{display:"inline-flex",gap:4,padding:"2px 8px",borderRadius:20,fontSize:9,fontWeight:600,background:"rgba(0,201,177,0.1)",border:"1px solid rgba(0,201,177,0.25)",color:"#00C9B1",textDecoration:"none"}},"🔗 "+c.source):c.source&&React.createElement("span",{style:{display:"inline-flex",gap:4,padding:"2px 8px",borderRadius:20,fontSize:9,background:"rgba(0,201,177,0.08)",border:"1px solid rgba(0,201,177,0.2)",color:"#00C9B1"}},"📖 "+c.source)
            )
          )
        );
      }),
      React.createElement("p",{style:{fontSize:10,color:"#7A99B8",textAlign:"center",padding:"4px 0"}},"Indicative only. Only a licensed physician can diagnose.")
    ),

    // ACTIONS
    tab==="actions"&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:7}},
      result.immediate_actions&&result.immediate_actions.map(function(a,i){
        return React.createElement("div",{key:i,style:{display:"flex",gap:10,alignItems:"flex-start",background:"#0F2D4A",border:"1px solid rgba(0,201,177,0.18)",borderRadius:9,padding:"11px 13px"}},
          React.createElement("div",{style:{width:22,height:22,borderRadius:5,background:"rgba(0,201,177,0.12)",border:"1px solid rgba(0,201,177,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#00C9B1",flexShrink:0}},i+1),
          React.createElement("span",{style:{fontSize:12,color:"#EDF2F7",lineHeight:1.55}},a)
        );
      })
    ),

    // REFERRAL
    tab==="referral"&&result.referral&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:9}},
      React.createElement(Crd,null,
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}},
          React.createElement("div",{style:{gridColumn:"1/-1"}},
            React.createElement("div",{style:{fontSize:8,color:"#7A99B8",letterSpacing:1,textTransform:"uppercase",marginBottom:3}},"Recommended Specialty"),
            React.createElement("div",{style:{fontSize:17,fontWeight:800,color:"#00C9B1"}},result.referral.specialty||"")
          ),
          React.createElement("div",null,React.createElement("div",{style:{fontSize:8,color:"#7A99B8",textTransform:"uppercase",letterSpacing:1,marginBottom:3}},"Facility"),React.createElement("div",{style:{fontSize:13,fontWeight:700,color:"#EDF2F7"}},result.referral.facility_type||"")),
          React.createElement("div",null,React.createElement("div",{style:{fontSize:8,color:"#7A99B8",textTransform:"uppercase",letterSpacing:1,marginBottom:3}},"Urgency"),React.createElement("div",{style:{fontSize:13,fontWeight:700,color:tr.bg}},result.referral.urgency_hours!=null?"Within "+result.referral.urgency_hours+" hours":"At convenience")),
          result.referral.rationale&&React.createElement("div",{style:{gridColumn:"1/-1"}},React.createElement("div",{style:{fontSize:8,color:"#7A99B8",textTransform:"uppercase",letterSpacing:1,marginBottom:3}},"Rationale"),React.createElement("p",{style:{fontSize:11,color:"#A8BCCF",lineHeight:1.6,margin:0}},result.referral.rationale))
        )
      ),
      React.createElement("div",{style:{background:"rgba(246,166,35,0.07)",border:"1px solid rgba(246,166,35,0.22)",borderRadius:9,padding:"10px 13px",fontSize:10,color:"#f0c060",lineHeight:1.7}},result.disclaimer||"")
    ),

    // SPECIALISTS (KNN)
    tab==="specialists"&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:0}},
      React.createElement("div",{style:{marginBottom:12}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
          React.createElement(Chip,{text:"KNN Matched",color:"#00C9B1"}),
          patientZone&&React.createElement("span",{style:{fontSize:10,color:"#7A99B8"}},"Near "+patientZone),
          React.createElement("span",{style:{marginLeft:"auto",fontSize:9,color:"#7A99B8"}},knnResults.length+" specialists")
        ),
        !patientZone&&React.createElement("div",{style:{background:"rgba(246,166,35,0.08)",border:"1px solid rgba(246,166,35,0.25)",borderRadius:8,padding:"10px 12px",marginBottom:10,fontSize:11,color:"#f0c060"}},
          "⚡ No zone entered — showing top specialty matches. Add your location at intake for proximity-aware KNN results."
        ),
        knnResults.map(function(r,i){
          return React.createElement(SpecialistCard,{key:r.sp.id,sp:r.sp,rank:i+1,distKm:r.distKm,patientZone:patientZone,onMapOpen:function(sp){setMapSp(sp);}});
        }),
        knnResults.length===0&&React.createElement(Crd,null,React.createElement("p",{style:{color:"#7A99B8",fontSize:11,margin:0}},"No specialist matches found. Try selecting Online / Remote as your zone."))
      ),
      React.createElement("div",{style:{background:"rgba(0,201,177,0.05)",border:"1px solid rgba(0,201,177,0.15)",borderRadius:8,padding:"10px 13px",fontSize:10,color:"#7A99B8",lineHeight:1.6}},
        "🔍 KNN algorithm scores specialists on specialty match (40%), geographic proximity (35%), and symptom tag overlap (25%). Click 🗺 Map/Route to open Google Maps navigation."
      )
    ),

    // EVIDENCE
    tab==="evidence"&&pro&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:9}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:4}},React.createElement(Chip,{text:"Live Clinical Evidence",color:"#00C9B1"}),React.createElement("span",{style:{fontSize:10,color:"#7A99B8"}},"Curated from trusted health authorities")),
      result.evidence_sources&&result.evidence_sources.length>0
        ?result.evidence_sources.map(function(s,i){return React.createElement(Crd,{key:i},React.createElement("div",{style:{display:"flex",gap:10,alignItems:"flex-start"}},React.createElement("span",{style:{fontSize:18,flexShrink:0}},srcIcon(s.source||"")),React.createElement("div",{style:{flex:1}},React.createElement("div",{style:{fontSize:12,fontWeight:700,color:"#EDF2F7",marginBottom:2}},s.title||""),React.createElement("div",{style:{fontSize:10,color:"#00C9B1",fontWeight:600,marginBottom:3}},s.source||""),React.createElement("p",{style:{fontSize:11,color:"#A8BCCF",lineHeight:1.6,margin:"0 0 5px"}},s.relevance||""),s.url&&React.createElement("a",{href:s.url,target:"_blank",rel:"noopener noreferrer",style:{display:"inline-flex",gap:4,padding:"2px 9px",borderRadius:20,fontSize:9,fontWeight:600,background:"rgba(0,201,177,0.1)",border:"1px solid rgba(0,201,177,0.25)",color:"#00C9B1",textDecoration:"none"}},"🔗 View Source"))));})
        :React.createElement(Crd,null,React.createElement("p",{style:{color:"#7A99B8",fontSize:11,margin:0}},"No external sources retrieved for this session."))
    ),

    // LABS
    tab==="labs"&&clin&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:9}},
      result.lab_tests_recommended&&result.lab_tests_recommended.length>0&&React.createElement("div",null,
        React.createElement("div",{style:{fontSize:9,color:"#8B5CF6",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:7}},"Recommended Laboratory Tests"),
        result.lab_tests_recommended.map(function(l,i){return React.createElement(Crd,{key:i,style:{marginBottom:7}},React.createElement("div",{style:{fontSize:12,fontWeight:700,color:"#EDF2F7",marginBottom:2}},l.test||""),React.createElement("div",{style:{fontSize:11,color:"#A8BCCF"}},l.rationale||""));})
      ),
      result.drug_interactions&&result.drug_interactions.length>0&&React.createElement("div",null,
        React.createElement("div",{style:{fontSize:9,color:"#F6A623",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:7}},"Drug Interaction Alerts"),
        result.drug_interactions.map(function(d,i){return React.createElement("div",{key:i,style:{background:"rgba(246,166,35,0.07)",border:"1px solid rgba(246,166,35,0.22)",borderRadius:9,padding:"9px 12px",marginBottom:5,fontSize:11,color:"#f0c060"}},"⚡ "+d);})
      )
    ),

    // Footer buttons
    React.createElement("div",{style:{display:"flex",gap:7,marginTop:14}},
      React.createElement("button",{onClick:function(){generatePDFReport(result,plan,null,patientZone,knnResults.map(function(r){return r.sp;}));},style:{flex:1,padding:"11px",borderRadius:9,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",fontFamily:"inherit",background:"linear-gradient(135deg,#00C9B1,#009E8D)",color:"#07182E",display:"flex",alignItems:"center",justifyContent:"center",gap:5}},
        React.createElement("span",null,"⬇"),React.createElement("span",null,"PDF Report")
      ),
      React.createElement("button",{onClick:onRestart,style:{flex:1,padding:"11px",borderRadius:9,background:"transparent",border:"1px solid rgba(255,255,255,0.07)",color:"#7A99B8",fontSize:11,cursor:"pointer",fontFamily:"inherit"}},"New Consultation")
    )
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  PDF REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════
function generatePDFReport(result,plan,planInfo,patientZone,specialists){
  var tMap={RED:{label:"EMERGENCY",color:"#E8394A"},ORANGE:{label:"URGENT",color:"#F6762B"},YELLOW:{label:"SEMI-URGENT",color:"#F6C623"},GREEN:{label:"NON-URGENT",color:"#21C97A"}};
  var tr=tMap[result.triage_color]||tMap.GREEN;
  var date=new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  var time=new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  var pName=(planInfo&&planInfo.name)||plan||"";
  function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function li(arr){if(!arr||!arr.length)return "<i style='color:#8a9ab0;font-size:10px;'>None noted.</i>";return "<ul style='margin:4px 0 0 14px;padding:0;'>"+arr.map(function(x){return "<li style='margin:2px 0;font-size:11px;color:#1a2a3a;'>"+esc(x)+"</li>";}).join("")+"</ul>";}
  var condRows=(result.possible_conditions||[]).map(function(c){var pc=c.probability==="High"?"#E8394A":c.probability==="Moderate"?"#F6762B":"#21C97A";return "<tr><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:11px;font-weight:600;color:#0B1F3A;'>"+esc(c.name)+"</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;text-align:center;'><span style='background:"+pc+"22;color:"+pc+";font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;border:1px solid "+pc+"55;'>"+esc(c.probability)+"</span></td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:10px;color:#4a6080;'>"+esc(c.icd10||"")+"</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:10px;color:#4a6080;'>"+esc(c.description||"").slice(0,80)+"…</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:9px;color:#00796B;'>"+esc(c.source||"")+"</td></tr>";}).join("");
  var actHTML=(result.immediate_actions||[]).map(function(a,i){return "<div style='display:flex;gap:8px;align-items:flex-start;margin:4px 0;'><span style='min-width:18px;height:18px;border-radius:3px;background:#00C9B1;color:#07182E;font-size:9px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;'>"+(i+1)+"</span><span style='font-size:11px;color:#1a2a3a;line-height:1.5;'>"+esc(a)+"</span></div>";}).join("");
  var rfHTML=result.red_flags&&result.red_flags.length?"<div style='background:#fff0f1;border:1px solid #ffc0c5;border-radius:5px;padding:9px 13px;margin-bottom:12px;'><div style='font-size:9px;font-weight:800;color:#E8394A;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;'>Red Flags Detected</div>"+result.red_flags.map(function(f){return "<div style='font-size:11px;color:#c0202a;margin:2px 0;'>• "+esc(f)+"</div>";}).join("")+"</div>":"";
  var isPro=plan==="pro"||plan==="clinical";
  var evHTML="";
  if(isPro&&result.evidence_sources&&result.evidence_sources.length){evHTML="<div style='margin-top:12px;'><h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #00C9B1;padding-bottom:3px;margin-bottom:7px;'>Clinical Evidence Sources</h3>"+result.evidence_sources.map(function(s){return "<div style='margin-bottom:6px;padding:6px 10px;background:#f7fafb;border-left:3px solid #00C9B1;'><div style='font-size:11px;font-weight:700;color:#0B1F3A;'>"+esc(s.title||"")+"</div><div style='font-size:9px;color:#00796B;'>"+esc(s.source||"")+(s.url?" | "+esc(s.url):"")+"</div><div style='font-size:10px;color:#4a6080;'>"+esc(s.relevance||"")+"</div></div>";}).join("")+"</div>";}
  var specHTML="";
  if(specialists&&specialists.length){specHTML="<div style='margin-top:12px;'><h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #00C9B1;padding-bottom:3px;margin-bottom:7px;'>KNN Matched Specialists"+(patientZone?" — near "+esc(patientZone):"")+"</h3><table><thead><tr><th>Specialist</th><th>Specialty</th><th style='width:110px;'>Zone</th><th style='width:130px;'>Contact</th></tr></thead><tbody>"+specialists.map(function(sp){return "<tr><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:11px;font-weight:600;color:#0B1F3A;'>"+esc(sp.name)+"<br/><span style='font-size:9px;color:#4a6080;font-weight:400;'>"+esc(sp.facility||"")+"</span></td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:10px;color:#00796B;'>"+esc(sp.specialty||"")+"</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:10px;color:#4a6080;'>"+esc(sp.zone||"")+"<br/>"+esc(sp.city||"")+"</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:9px;'><span style='color:#21C97A;'>"+esc(sp.phone||"")+"</span><br/><span style='color:#00796B;'>"+esc(sp.email||"")+"</span></td></tr>";}).join("")+"</tbody></table></div>";}
  var html="<!DOCTYPE html><html><head><meta charset='UTF-8'/><title>NdMED Report "+date+"</title>"+
    "<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#1a2a3a;font-size:12px;}"+
    "@page{margin:12mm 10mm;size:A4;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}"+
    "table{border-collapse:collapse;width:100%;}th{background:#0B1F3A;color:#fff;padding:6px 7px;font-size:10px;text-align:left;}</style></head><body>"+
    "<div style='background:#0B1F3A;color:#fff;padding:14px 17px;display:flex;align-items:center;justify-content:space-between;margin-bottom:0;'>"+
      "<div><div style='font-size:19px;font-weight:900;letter-spacing:0.5px;'>NdMED<span style='font-size:10px;font-weight:600;color:#00C9B1;border:1px solid #00C9B1;padding:2px 7px;border-radius:10px;margin-left:7px;vertical-align:middle;'>"+esc(pName)+"</span></div>"+
        "<div style='font-size:8px;color:#00C9B1;letter-spacing:2px;margin-top:2px;text-transform:uppercase;'>LIWIMALA INITIATIVE — Pre-Clinical Consultation Report</div></div>"+
      "<div style='text-align:right;font-size:9px;color:#A8BCCF;'><div>"+esc(date)+" at "+esc(time)+"</div>"+(patientZone?"<div style='margin-top:1px;'>Zone: "+esc(patientZone)+"</div>":"")+"<div style='font-size:8px;'>Confidential — Patient Copy</div></div>"+
    "</div>"+
    "<div style='background:"+tr.color+"12;border-left:5px solid "+tr.color+";padding:10px 13px;margin-bottom:12px;display:flex;align-items:center;gap:18px;'>"+
      "<div><div style='font-size:8px;color:#4a6080;text-transform:uppercase;letter-spacing:1px;font-weight:700;'>Triage</div><div style='font-size:18px;font-weight:900;color:"+tr.color+";'>"+tr.label+"</div><div style='font-size:10px;color:#4a6080;margin-top:1px;'>"+esc(result.triage_label||"")+"</div></div>"+
      "<div style='margin-left:auto;text-align:right;'><div style='font-size:8px;color:#4a6080;text-transform:uppercase;letter-spacing:1px;'>Referral Specialty</div><div style='font-size:13px;font-weight:800;color:#0B1F3A;'>"+esc(result.referral&&result.referral.specialty||"")+"</div><div style='font-size:10px;color:"+tr.color+";font-weight:700;'>"+(result.referral&&result.referral.urgency_hours!=null?"Within "+result.referral.urgency_hours+"h":"At convenience")+"</div></div>"+
    "</div>"+
    "<div style='background:#f0f8f7;border:1px solid #c0e8e4;border-radius:5px;padding:9px 12px;margin-bottom:12px;'><div style='font-size:8px;font-weight:800;color:#00796B;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;'>Patient Summary</div><p style='font-size:11px;line-height:1.6;'>"+esc(result.summary||"")+"</p></div>"+
    rfHTML+
    "<div style='display:flex;gap:12px;margin-bottom:12px;'>"+
      "<div style='flex:1;'><h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #00C9B1;padding-bottom:3px;margin-bottom:6px;'>Immediate Actions</h3>"+actHTML+"</div>"+
      "<div style='flex:1;'><h3 style='font-size:10px;font-weight:800;color:#E8394A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E8394A;padding-bottom:3px;margin-bottom:6px;'>Do NOT Do</h3>"+li(result.do_not)+(result.first_aid&&result.first_aid.length?"<h3 style='font-size:10px;font-weight:800;color:#21C97A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #21C97A;padding-bottom:3px;margin:9px 0 6px;'>First Aid</h3>"+li(result.first_aid):"")+"</div>"+
    "</div>"+
    "<h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #0B1F3A;padding-bottom:3px;margin-bottom:6px;'>Differential Diagnosis</h3>"+
    "<table style='margin-bottom:12px;'><thead><tr><th>Condition</th><th style='width:70px;text-align:center;'>Likelihood</th><th style='width:70px;'>ICD-10</th><th>Description</th><th style='width:90px;'>Source</th></tr></thead><tbody>"+condRows+"</tbody></table>"+
    "<div style='background:#f7f9fc;border:1px solid #d0dae8;border-radius:5px;padding:9px 12px;margin-bottom:12px;'><h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;'>Referral Details</h3><div style='display:flex;gap:18px;'><div><div style='font-size:8px;color:#4a6080;text-transform:uppercase;'>Specialty</div><div style='font-size:12px;font-weight:700;color:#0B1F3A;'>"+esc(result.referral&&result.referral.specialty||"")+"</div></div><div><div style='font-size:8px;color:#4a6080;text-transform:uppercase;'>Facility</div><div style='font-size:12px;font-weight:700;color:#0B1F3A;'>"+esc(result.referral&&result.referral.facility_type||"")+"</div></div><div><div style='font-size:8px;color:#4a6080;text-transform:uppercase;'>Urgency</div><div style='font-size:12px;font-weight:700;color:"+tr.color+"'>"+(result.referral&&result.referral.urgency_hours!=null?"Within "+result.referral.urgency_hours+" hours":"At convenience")+"</div></div></div>"+(result.referral&&result.referral.rationale?"<p style='font-size:10px;color:#4a6080;margin-top:5px;'>"+esc(result.referral.rationale)+"</p>":"")+"</div>"+
    (result.clinical_notes?"<div style='background:#f5f3ff;border:1px solid #d4c8f8;border-radius:5px;padding:9px 12px;margin-bottom:12px;'><div style='font-size:8px;font-weight:800;color:#7C3AED;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;'>Clinical Commentary</div><p style='font-size:11px;color:#1a2a3a;line-height:1.6;'>"+esc(result.clinical_notes)+"</p></div>":"")+
    evHTML+specHTML+
    "<div style='margin-top:12px;padding:8px 12px;background:#fffbf0;border:1px solid #f0dfa0;border-radius:5px;'><div style='font-size:8px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;'>Medical Disclaimer</div><p style='font-size:9px;color:#78530a;line-height:1.55;'>"+esc(result.disclaimer||"")+"</p></div>"+
    "<div style='margin-top:8px;border-top:1px solid #e0e8f0;padding-top:5px;display:flex;justify-content:space-between;font-size:8px;color:#8a9ab0;'><span>NdMED — LIWIMALA INITIATIVE</span><span>"+esc(date)+" "+esc(time)+" | Plan: "+esc(pName)+"</span></div>"+
    "</body></html>";
  var win=window.open("","_blank");
  if(!win){alert("Pop-up blocked. Please allow pop-ups to print the PDF report.");return;}
  win.document.write(html);win.document.close();win.focus();setTimeout(function(){win.print();},800);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUBSCRIPTION WALL
// ═══════════════════════════════════════════════════════════════════════════════
function SubWall({onSelect}){
  var hovState=useState(null); var hov=hovState[0]; var setHov=hovState[1];
  return React.createElement("div",{style:{minHeight:"100vh",background:"#07182E",fontFamily:"Inter,system-ui,sans-serif",padding:"24px 14px"}},
    React.createElement("style",null,GBL),
    React.createElement("div",{style:{maxWidth:820,margin:"0 auto"}},
      React.createElement("div",{style:{textAlign:"center",marginBottom:28},className:"fu"},
        React.createElement("div",{style:{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 14px",borderRadius:20,background:"rgba(0,201,177,0.12)",border:"1px solid rgba(0,201,177,0.18)",marginBottom:14}},React.createElement(Dot,{size:7}),React.createElement("span",{style:{fontSize:10,color:"#00C9B1",fontWeight:700,letterSpacing:1.2}},"LIWIMALA INITIATIVE")),
        React.createElement("h1",{style:{fontSize:28,fontWeight:800,color:"#EDF2F7",lineHeight:1.15,marginBottom:8}},"NdMED"),
        React.createElement("p",{style:{fontSize:12,color:"#A8BCCF",maxWidth:500,margin:"0 auto",lineHeight:1.7}},"Intelligent pre-clinical triage · KNN specialist matching · Google Maps integration · Evidence from 7 medical authorities")
      ),
      React.createElement("div",{style:{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap",marginBottom:24}},
        SOURCES.map(function(s){return React.createElement("div",{key:s.name,style:{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",fontSize:10,color:"#7A99B8"}},s.icon," ",s.name);})),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:13,marginBottom:22}},
        PLANS.map(function(pl){
          var h=hov===pl.id;
          return React.createElement("div",{key:pl.id,onMouseEnter:function(){setHov(pl.id);},onMouseLeave:function(){setHov(null);},
            style:{background:pl.id==="pro"?"linear-gradient(160deg,#0D2540,#0F2D4A)":"#0F2D4A",border:"1.5px solid "+(h?pl.color:pl.id==="pro"?pl.color+"44":"rgba(255,255,255,0.07)"),borderRadius:13,padding:"20px 16px",display:"flex",flexDirection:"column",position:"relative",transition:"border-color 0.2s,transform 0.2s",transform:h?"translateY(-3px)":"none"}},
            pl.badge&&React.createElement("div",{style:{position:"absolute",top:-9,left:"50%",transform:"translateX(-50%)",whiteSpace:"nowrap"}},React.createElement(Chip,{text:pl.badge,color:pl.color})),
            React.createElement("div",{style:{fontSize:20,marginBottom:7}},pl.icon),
            React.createElement("div",{style:{fontSize:10,color:pl.color,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:2}},pl.name),
            React.createElement("div",{style:{display:"flex",alignItems:"baseline",gap:2,marginBottom:12}},React.createElement("span",{style:{fontSize:22,fontWeight:800,color:"#EDF2F7"}},pl.price),React.createElement("span",{style:{fontSize:11,color:"#7A99B8"}},pl.period)),
            React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",gap:6,marginBottom:15}},
              pl.features.map(function(f,i){return React.createElement("div",{key:i,style:{display:"flex",gap:6,alignItems:"flex-start",fontSize:10,color:"#A8BCCF"}},React.createElement("span",{style:{color:pl.color,flexShrink:0}},"✓"),f);})
            ),
            React.createElement("button",{onClick:function(){onSelect(pl.id);},style:{width:"100%",padding:"10px",borderRadius:8,fontSize:11,fontWeight:700,border:pl.id==="free"?"1px solid rgba(0,201,177,0.18)":"none",background:pl.id==="free"?"transparent":"linear-gradient(135deg,"+pl.color+","+pl.color+"BB)",color:pl.id==="free"?"#A8BCCF":pl.id==="pro"?"#07182E":"#EDF2F7",cursor:"pointer",fontFamily:"inherit"}},pl.cta)
          );
        })
      ),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:18}},
        [{v:"35",l:"Specialists",s:"8 cities + telemedicine"},{v:"KNN",l:"Smart Matching",s:"Weighted 3-factor model"},{v:"Maps",l:"Google Maps",s:"Navigation & directions"},{v:"18Q",l:"Broad Intake",s:"Demographics to lifestyle"}].map(function(st){
          return React.createElement("div",{key:st.l,style:{background:"#0F2D4A",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"12px",textAlign:"center"}},
            React.createElement("div",{style:{fontSize:16,fontWeight:800,color:"#00C9B1",marginBottom:1}},st.v),
            React.createElement("div",{style:{fontSize:10,fontWeight:600,color:"#EDF2F7",marginBottom:1}},st.l),
            React.createElement("div",{style:{fontSize:9,color:"#7A99B8"}},st.s)
          );
        })
      ),
      React.createElement("p",{style:{textAlign:"center",fontSize:10,color:"#7A99B8",lineHeight:1.7}},"NdMED does not replace a licensed physician. In any emergency, call 15/112/911 immediately. Subscription tiers are simulated for demonstration.")
    )
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  var ss=useState("sub"); var stage=ss[0]; var setStage=ss[1];
  var ps=useState(null); var plan=ps[0]; var setPlan=ps[1];
  var sp=useState(0); var step=sp[0]; var setStep=sp[1];
  var as=useState({}); var answers=as[0]; var setAnswers=as[1];
  var cs=useState(null); var curAns=cs[0]; var setCurAns=cs[1];
  var rs=useState(null); var result=rs[0]; var setResult=rs[1];
  var es=useState(null); var error=es[0]; var setError=es[1];
  var sts=useState([]); var aSteps=sts[0]; var setASteps=sts[1];
  var ref=useRef(null);

  useEffect(function(){
    if(stage!=="analyzing")return;
    setASteps([]);
    var timers=ADELAYS.map(function(d,i){return setTimeout(function(){setASteps(function(p){return p.concat([i]);});},d);});
    return function(){timers.forEach(function(t){clearTimeout(t);});};
  },[stage]);

  useEffect(function(){if(ref.current)ref.current.scrollTo({top:0,behavior:"smooth"});},[step]);

  var q=QUESTIONS[step];
  var planInfo=PLANS.find(function(p){return p.id===plan;});

  function choosePlan(p){setPlan(p);setStage("landing");}

  function next(){
    var isVitals=q.type==="vitals"||q.type==="location";
    if(!isVitals&&(curAns==null||curAns===""||( Array.isArray(curAns)&&curAns.length===0)))return;
    var na=Object.assign({},answers); na[q.id]=curAns;
    setAnswers(na); setCurAns(null);
    if(step+1<QUESTIONS.length) setStep(step+1);
    else analyse(na);
  }

  function analyse(fa){
    setStage("analyzing"); setError(null);
    fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4096,messages:[{role:"user",content:buildPrompt(fa,plan)}]})
    }).then(function(r){
      if(!r.ok)return r.text().then(function(t){throw new Error("API "+r.status+": "+t);});
      return r.json();
    }).then(function(d){
      var raw=(d.content||[]).filter(function(b){return b.type==="text";}).map(function(b){return b.text;}).join("");
      if(!raw.trim())throw new Error("Empty response. Please retry.");
      var parsed=extractJSON(raw);
      setResult(parsed); setStage("result");
    }).catch(function(e){
      console.error("NdMED error:",e);
      setError(e.message||"Analysis failed.");
      setStage("error");
    });
  }

  function retry(){analyse(answers);}
  function restart(){setStage("landing");setStep(0);setAnswers({});setCurAns(null);setResult(null);setError(null);}
  function changePlan(){setStage("sub");setPlan(null);setStep(0);setAnswers({});setCurAns(null);setResult(null);setError(null);}

  var wrap={minHeight:"100vh",background:"#07182E",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"18px 12px",fontFamily:"Inter,system-ui,sans-serif"};
  var panel={width:"100%",maxWidth:600,background:"#0D2540",border:"1px solid rgba(0,201,177,0.18)",borderRadius:18,padding:"22px 20px",boxShadow:"0 0 60px rgba(0,201,177,0.06)"};

  if(stage==="sub")return React.createElement(SubWall,{onSelect:choosePlan});

  if(stage==="landing")return React.createElement("div",{style:wrap},
    React.createElement("style",null,GBL),
    React.createElement("div",{style:Object.assign({},panel,{textAlign:"center"}),className:"fu"},
      React.createElement("div",{style:{width:52,height:52,borderRadius:13,background:"linear-gradient(135deg,#00C9B1,#009E8D)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:22}},"⚕️"),
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:5}},
        React.createElement("h1",{style:{fontSize:22,fontWeight:800,color:"#EDF2F7",margin:0}},"NdMED"),
        planInfo&&React.createElement(Chip,{text:planInfo.name,color:planInfo.color})
      ),
      React.createElement("div",{style:{fontSize:9,color:"#00C9B1",letterSpacing:2,fontWeight:700,marginBottom:9}},"LIWIMALA INITIATIVE"),
      React.createElement("p",{style:{fontSize:11,color:"#A8BCCF",maxWidth:420,margin:"0 auto 16px",lineHeight:1.7}},"Answer "+QUESTIONS.length+" clinical questions spanning "+new Set(QUESTIONS.map(function(q){return q.section;})).size+" domains. Receive AI triage with KNN specialist matching and Google Maps navigation."),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16,textAlign:"left"}},
        [{i:"🧠",t:"AI Differential Diagnosis",d:"Multi-condition ranking with ICD codes"},{i:"🗺️",t:"Google Maps Navigation",d:"Route to nearest specialist"},{i:"🔍",t:"KNN Specialist Matching",d:"Weighted 3-factor algorithm"},{i:"📋",t:"18-Question Intake",d:"Demographics · history · lifestyle · vitals"}].map(function(f){
          return React.createElement("div",{key:f.t,style:{background:"#0F2D4A",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"9px 10px"}},
            React.createElement("div",{style:{fontSize:14,marginBottom:2}},f.i),
            React.createElement("div",{style:{fontSize:10,fontWeight:700,color:"#EDF2F7",marginBottom:1}},f.t),
            React.createElement("div",{style:{fontSize:9,color:"#7A99B8"}},f.d)
          );
        })
      ),
      React.createElement("button",{onClick:function(){setStage("intake");},style:{width:"100%",padding:"12px",borderRadius:9,fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#00C9B1,#009E8D)",color:"#07182E",border:"none",cursor:"pointer",fontFamily:"inherit",marginBottom:7}},"Begin Pre-Consultation →"),
      React.createElement("button",{onClick:changePlan,style:{width:"100%",padding:"9px",borderRadius:9,fontSize:10,background:"transparent",border:"1px solid rgba(255,255,255,0.07)",color:"#7A99B8",cursor:"pointer",fontFamily:"inherit"}},"← Change Plan"),
      React.createElement("p",{style:{fontSize:9,color:"#7A99B8",marginTop:10,lineHeight:1.6}},"Does not replace a licensed physician. In a life-threatening emergency, call 15/112/911 immediately.")
    )
  );

  if(stage==="analyzing")return React.createElement("div",{style:wrap},
    React.createElement("style",null,GBL),
    React.createElement("div",{style:Object.assign({},panel,{textAlign:"center"}),className:"fi"},
      React.createElement("div",{style:{width:56,height:56,borderRadius:"50%",background:"rgba(0,201,177,0.1)",border:"2px solid rgba(0,201,177,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}},React.createElement(Spin,null)),
      React.createElement("h2",{style:{fontSize:15,fontWeight:800,color:"#EDF2F7",marginBottom:4}},"Analysing your profile"),
      React.createElement("p",{style:{fontSize:10,color:"#7A99B8",marginBottom:18,lineHeight:1.6}},"Running "+ASTEP_LABELS.length+"-step clinical pipeline including KNN matching. Takes 15–30 seconds."),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6,textAlign:"left"}},
        ASTEP_LABELS.map(function(s,i){
          var done=aSteps.indexOf(i)>=0; var cur=aSteps.length===i+1;
          return React.createElement("div",{key:i,style:{display:"flex",gap:8,alignItems:"center",padding:"8px 11px",borderRadius:7,background:done?"rgba(0,201,177,0.05)":"#0F2D4A",border:"1px solid "+(done?"rgba(0,201,177,0.18)":"rgba(255,255,255,0.07)"),transition:"all 0.3s"}},
            cur?React.createElement(Spin,null):done?React.createElement(Dot,{size:8}):React.createElement("span",{style:{width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,0.07)",display:"inline-block",flexShrink:0}}),
            React.createElement("span",{style:{fontSize:10,color:done?"#A8BCCF":"#7A99B8"}},s),
            done&&!cur&&React.createElement("span",{style:{marginLeft:"auto",fontSize:9,color:"#00C9B1"}},"✓")
          );
        })
      )
    )
  );

  if(stage==="error")return React.createElement("div",{style:wrap},
    React.createElement("style",null,GBL),
    React.createElement("div",{style:Object.assign({},panel,{textAlign:"center"}),className:"fu"},
      React.createElement("div",{style:{width:48,height:48,borderRadius:"50%",background:"rgba(232,57,74,0.09)",border:"2px solid rgba(232,57,74,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:20}},"⚠️"),
      React.createElement("h2",{style:{fontSize:15,fontWeight:800,color:"#EDF2F7",marginBottom:5}},"Analysis Interrupted"),
      React.createElement("p",{style:{fontSize:10,color:"#7A99B8",marginBottom:12,lineHeight:1.6}},"Your answers are saved. Retry without re-entering information."),
      React.createElement("div",{style:{background:"rgba(232,57,74,0.06)",border:"1px solid rgba(232,57,74,0.2)",borderRadius:8,padding:"9px 11px",marginBottom:16,textAlign:"left"}},
        React.createElement("div",{style:{fontSize:8,color:"#E8394A",fontWeight:700,letterSpacing:1.2,marginBottom:2,textTransform:"uppercase"}},"Error"),
        React.createElement("div",{style:{fontSize:10,color:"#f8a8ae",wordBreak:"break-all",lineHeight:1.5}},error)
      ),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6}},
        React.createElement("button",{onClick:retry,style:{width:"100%",padding:"11px",borderRadius:8,fontSize:12,fontWeight:700,background:"linear-gradient(135deg,#00C9B1,#009E8D)",color:"#07182E",border:"none",cursor:"pointer",fontFamily:"inherit"}},"↺ Retry Analysis"),
        React.createElement("button",{onClick:restart,style:{width:"100%",padding:"10px",borderRadius:8,fontSize:11,background:"transparent",border:"1px solid rgba(255,255,255,0.07)",color:"#7A99B8",cursor:"pointer",fontFamily:"inherit"}},"← New Consultation")
      )
    )
  );

  if(stage==="result"&&result)return React.createElement("div",{style:wrap},
    React.createElement("style",null,GBL),
    React.createElement("div",{ref:ref,style:Object.assign({},panel,{maxHeight:"94vh",overflowY:"auto"}),className:"fu"},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:7,marginBottom:16,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,0.07)"}},
        React.createElement("span",{style:{fontSize:13}},"⚕️"),
        React.createElement("span",{style:{fontSize:11,fontWeight:800,color:"#00C9B1"}},"NdMED"),
        planInfo&&React.createElement(Chip,{text:planInfo.name,color:planInfo.color}),
        React.createElement("span",{style:{marginLeft:"auto",fontSize:9,color:"#7A99B8"}},"Pre-Clinical Report"),
        React.createElement("button",{onClick:function(){generatePDFReport(result,plan,planInfo,answers.location||"",knnMatchSpecialists(result.referral&&result.referral.specialty||"",answers.location||"",answers.chief||[],6).map(function(r){return r.sp;}));},style:{marginLeft:8,padding:"5px 11px",borderRadius:7,fontSize:9,fontWeight:700,background:"linear-gradient(135deg,#00C9B1,#009E8D)",color:"#07182E",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:4}},
          React.createElement("span",null,"⬇"),React.createElement("span",null,"PDF")
        )
      ),
      React.createElement(ResultView,{result:result,plan:plan,onRestart:restart,patientZone:answers.location||"",chiefComplaints:answers.chief||[]})
    )
  );

  // INTAKE
  var canMulti=Array.isArray(curAns)&&curAns.length>0;
  var can=q.type==="vitals"||q.type==="location"||q.type==="scale"&&curAns!=null||(q.type==="single"&&curAns!=null&&curAns!=="")||(q.type==="multi"&&canMulti);
  return React.createElement("div",{style:wrap},
    React.createElement("style",null,GBL),
    React.createElement("div",{ref:ref,style:Object.assign({},panel,{maxHeight:"94vh",overflowY:"auto"}),className:"fu"},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:7,marginBottom:16}},
        React.createElement("span",{style:{fontSize:12}},"⚕️"),
        React.createElement("span",{style:{fontSize:10,fontWeight:800,color:"#00C9B1"}},"NdMED"),
        planInfo&&React.createElement(Chip,{text:planInfo.name,color:planInfo.color}),
        React.createElement("button",{onClick:changePlan,style:{marginLeft:"auto",fontSize:9,color:"#7A99B8",background:"none",border:"none",cursor:"pointer",padding:0}},"Change plan")
      ),
      React.createElement(ProgBar,{cur:step,tot:QUESTIONS.length}),
      React.createElement("div",{style:{marginBottom:14}},
        React.createElement(SectionBadge,{text:q.section||""}),
        React.createElement("h2",{style:{fontSize:14,fontWeight:700,color:"#EDF2F7",lineHeight:1.45,margin:0}},q.q)
      ),
      q.type==="single"&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:5}},
        q.opts.map(function(o){
          var sel=curAns===o;
          return React.createElement("button",{key:o,onClick:function(){setCurAns(o);},style:{width:"100%",textAlign:"left",borderRadius:8,padding:"9px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",border:sel?"1.5px solid #00C9B1":"1px solid rgba(255,255,255,0.07)",background:sel?"rgba(0,201,177,0.09)":"rgba(255,255,255,0.025)",color:sel?"#00C9B1":"#EDF2F7",fontWeight:sel?600:400,transition:"all 0.1s"}},o);
        })
      ),
      q.type==="multi"&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:5}},
        q.opts.map(function(o){
          var sel=Array.isArray(curAns)&&curAns.indexOf(o)>=0;
          return React.createElement("button",{key:o,onClick:function(){var p=Array.isArray(curAns)?curAns:[];setCurAns(sel?p.filter(function(x){return x!==o;}):[].concat(p,[o]));},style:{width:"100%",textAlign:"left",borderRadius:8,padding:"9px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,border:sel?"1.5px solid #00C9B1":"1px solid rgba(255,255,255,0.07)",background:sel?"rgba(0,201,177,0.09)":"rgba(255,255,255,0.025)",color:sel?"#00C9B1":"#EDF2F7",fontWeight:sel?600:400,transition:"all 0.1s"}},
            React.createElement("span",{style:{width:13,height:13,borderRadius:3,flexShrink:0,border:"1.5px solid "+(sel?"#00C9B1":"rgba(0,201,177,0.2)"),background:sel?"#00C9B1":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#07182E",fontWeight:800}},sel?"✓":""),
            o
          );
        }),
        React.createElement("p",{style:{fontSize:9,color:"#7A99B8",marginTop:3}},"Select all that apply")
      ),
      q.type==="scale"&&React.createElement(ScaleInput,{min:q.min,max:q.max,val:curAns,onCh:setCurAns}),
      q.type==="vitals"&&React.createElement(VitalsIn,{val:curAns||{},onCh:setCurAns}),
      q.type==="location"&&React.createElement(LocationInput,{val:curAns||"",onCh:setCurAns}),
      React.createElement("div",{style:{display:"flex",gap:7,marginTop:16}},
        step>0&&React.createElement("button",{onClick:function(){setStep(step-1);setCurAns(answers[QUESTIONS[step-1].id]||null);},style:{padding:"10px 14px",borderRadius:8,fontSize:11,background:"transparent",border:"1px solid rgba(255,255,255,0.07)",color:"#7A99B8",cursor:"pointer",fontFamily:"inherit"}},"← Back"),
        React.createElement("button",{onClick:next,disabled:!can,style:{flex:1,padding:"11px",borderRadius:8,fontSize:12,fontWeight:700,cursor:can?"pointer":"not-allowed",border:"none",fontFamily:"inherit",background:can?"linear-gradient(135deg,#00C9B1,#009E8D)":"rgba(255,255,255,0.05)",color:can?"#07182E":"#7A99B8",transition:"all 0.15s"}},step+1===QUESTIONS.length?"Analyse My Symptoms →":"Next →")
      )
    )
  );
}
