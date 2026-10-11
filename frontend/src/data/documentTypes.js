// Document groups ("clusters") and the document types inside each one.
// Each type is [key, English, Hindi, Marathi]. The KEY is what's saved in the database, so labels can be
// improved or translated later without touching saved data. To add a type: add one line below.
export const CLUSTERS = ["academic", "personal", "work", "other"];

const TYPES = {
 "academic": [
  [
   "school_marksheet",
   "School marksheets (10th / 12th)",
   "स्कूल अंकतालिका (10वीं / 12वीं)",
   "शाळेची गुणपत्रिका (१०वी / १२वी)"
  ],
  [
   "leaving_cert",
   "Leaving / transfer certificate",
   "स्थानांतरण प्रमाणपत्र (TC)",
   "शाळा सोडल्याचा दाखला (LC)"
  ],
  [
   "bonafide",
   "Bonafide certificate",
   "बोनाफाइड प्रमाणपत्र",
   "बोनाफाईड प्रमाणपत्र"
  ],
  [
   "admit_card",
   "Admit card / hall ticket",
   "प्रवेश पत्र / हॉल टिकट",
   "प्रवेशपत्र / हॉल तिकीट"
  ],
  [
   "semester_marksheet",
   "Semester marksheets / transcripts",
   "सेमेस्टर अंकतालिका / ट्रांसक्रिप्ट",
   "सेमिस्टर गुणपत्रिका / ट्रान्सक्रिप्ट"
  ],
  [
   "degree_cert",
   "Degree / provisional certificate",
   "डिग्री / अनंतिम प्रमाणपत्र",
   "पदवी / तात्पुरते प्रमाणपत्र"
  ],
  [
   "entrance_score",
   "Entrance exam scorecard (JEE / CET / NEET / GATE)",
   "प्रवेश परीक्षा स्कोरकार्ड (JEE / CET / NEET / GATE)",
   "प्रवेश परीक्षा स्कोअरकार्ड (JEE / CET / NEET / GATE)"
  ],
  [
   "fee_receipt",
   "Fee receipts",
   "फीस की रसीदें",
   "शुल्क पावत्या"
  ],
  [
   "scholarship",
   "Scholarship documents",
   "छात्रवृत्ति दस्तावेज़",
   "शिष्यवृत्ती कागदपत्रे"
  ],
  [
   "caste_cert",
   "Caste / non-creamy layer certificate",
   "जाति / नॉन-क्रीमी लेयर प्रमाणपत्र",
   "जात / नॉन-क्रीमीलेयर प्रमाणपत्र"
  ],
  [
   "domicile",
   "Domicile / nationality certificate",
   "अधिवास / राष्ट्रीयता प्रमाणपत्र",
   "अधिवास / राष्ट्रीयत्व प्रमाणपत्र"
  ],
  [
   "migration_cert",
   "Migration certificate",
   "माइग्रेशन प्रमाणपत्र",
   "मायग्रेशन प्रमाणपत्र"
  ],
  [
   "gap_cert",
   "Gap certificate",
   "गैप प्रमाणपत्र",
   "गॅप प्रमाणपत्र"
  ],
  [
   "internship",
   "Internship / training certificate",
   "इंटर्नशिप / प्रशिक्षण प्रमाणपत्र",
   "इंटर्नशिप / प्रशिक्षण प्रमाणपत्र"
  ],
  [
   "competition",
   "Competition / hackathon certificate",
   "प्रतियोगिता / हैकाथॉन प्रमाणपत्र",
   "स्पर्धा / हॅकाथॉन प्रमाणपत्र"
  ],
  [
   "project_report",
   "Project report / thesis",
   "प्रोजेक्ट रिपोर्ट / थीसिस",
   "प्रकल्प अहवाल / प्रबंध"
  ],
  [
   "research_paper",
   "Research paper / publication",
   "शोध पत्र / प्रकाशन",
   "संशोधन पेपर / प्रकाशन"
  ],
  [
   "study_notes",
   "Lecture notes / study material",
   "लेक्चर नोट्स / अध्ययन सामग्री",
   "व्याख्यान नोट्स / अभ्यास साहित्य"
  ],
  [
   "student_id",
   "Student ID / library card",
   "छात्र पहचान पत्र / लाइब्रेरी कार्ड",
   "विद्यार्थी ओळखपत्र / ग्रंथालय कार्ड"
  ],
  [
   "lesson_plan",
   "Lesson plans / syllabus",
   "पाठ योजना / पाठ्यक्रम",
   "पाठ नियोजन / अभ्यासक्रम"
  ],
  [
   "question_papers",
   "Question papers & answer keys",
   "प्रश्न पत्र और उत्तर कुंजी",
   "प्रश्नपत्रिका आणि उत्तरसूची"
  ],
  [
   "attendance_results",
   "Attendance & result sheets",
   "उपस्थिति और परिणाम पत्रक",
   "उपस्थिती आणि निकाल पत्रके"
  ],
  [
   "teacher_quals",
   "NET / SET / PhD & training certificates",
   "NET / SET / पीएच.डी. और प्रशिक्षण प्रमाणपत्र",
   "NET / SET / पीएच.डी. आणि प्रशिक्षण प्रमाणपत्रे"
  ],
  [
   "teaching_exp",
   "Teaching experience letters",
   "शिक्षण अनुभव पत्र",
   "अध्यापन अनुभव पत्र"
  ]
 ],
 "personal": [
  [
   "aadhaar",
   "Aadhaar card",
   "आधार कार्ड",
   "आधार कार्ड"
  ],
  [
   "pan",
   "PAN card",
   "पैन कार्ड",
   "पॅन कार्ड"
  ],
  [
   "passport",
   "Passport",
   "पासपोर्ट",
   "पासपोर्ट"
  ],
  [
   "voter_id",
   "Voter ID",
   "मतदाता पहचान पत्र",
   "मतदार ओळखपत्र"
  ],
  [
   "driving_licence",
   "Driving licence",
   "ड्राइविंग लाइसेंस",
   "वाहन चालक परवाना"
  ],
  [
   "ration_card",
   "Ration card",
   "राशन कार्ड",
   "रेशन कार्ड"
  ],
  [
   "photo_sign",
   "Photos & signature scans",
   "फ़ोटो और हस्ताक्षर स्कैन",
   "फोटो आणि स्वाक्षरी स्कॅन"
  ],
  [
   "birth_cert",
   "Birth certificate",
   "जन्म प्रमाणपत्र",
   "जन्म प्रमाणपत्र"
  ],
  [
   "marriage_cert",
   "Marriage certificate",
   "विवाह प्रमाणपत्र",
   "विवाह प्रमाणपत्र"
  ],
  [
   "affidavit",
   "Affidavits / legal notices",
   "शपथ पत्र / कानूनी नोटिस",
   "प्रतिज्ञापत्र / कायदेशीर नोटीस"
  ],
  [
   "police_verification",
   "Police verification / character certificate",
   "पुलिस सत्यापन / चरित्र प्रमाणपत्र",
   "पोलीस पडताळणी / चारित्र्य प्रमाणपत्र"
  ],
  [
   "prescription",
   "Prescriptions",
   "डॉक्टर के पर्चे",
   "डॉक्टरांची प्रिस्क्रिप्शन"
  ],
  [
   "lab_report",
   "Lab / test reports",
   "लैब / जाँच रिपोर्ट",
   "प्रयोगशाळा / तपासणी अहवाल"
  ],
  [
   "vaccination",
   "Vaccination records",
   "टीकाकरण रिकॉर्ड",
   "लसीकरण नोंदी"
  ],
  [
   "medical_bill",
   "Medical bills & discharge summaries",
   "मेडिकल बिल और डिस्चार्ज सारांश",
   "वैद्यकीय बिले आणि डिस्चार्ज सारांश"
  ],
  [
   "bank_statement",
   "Bank statements / passbook",
   "बैंक स्टेटमेंट / पासबुक",
   "बँक स्टेटमेंट / पासबुक"
  ],
  [
   "itr_form16",
   "Income tax return / Form 16",
   "आयकर रिटर्न / फ़ॉर्म 16",
   "आयकर विवरणपत्र / फॉर्म १६"
  ],
  [
   "investment",
   "Investment proofs (PPF / FD / ELSS)",
   "निवेश प्रमाण (PPF / FD / ELSS)",
   "गुंतवणूक पुरावे (PPF / FD / ELSS)"
  ],
  [
   "loan",
   "Loan documents",
   "ऋण दस्तावेज़",
   "कर्ज कागदपत्रे"
  ],
  [
   "insurance",
   "Insurance policies (life / health / home)",
   "बीमा पॉलिसी (जीवन / स्वास्थ्य / घर)",
   "विमा पॉलिसी (जीवन / आरोग्य / घर)"
  ],
  [
   "sale_deed",
   "Sale deed / property papers",
   "बिक्री विलेख / संपत्ति के कागज़ात",
   "खरेदीखत / मालमत्ता कागदपत्रे"
  ],
  [
   "land_record",
   "7/12 extract / land records",
   "7/12 उतारा / भू-अभिलेख",
   "७/१२ उतारा / जमीन अभिलेख"
  ],
  [
   "rent_agreement",
   "Rent agreement",
   "किराया समझौता",
   "भाडेकरार"
  ],
  [
   "property_bills",
   "Property tax & utility bills",
   "संपत्ति कर और उपयोगिता बिल",
   "मालमत्ता कर आणि वीज/पाणी बिले"
  ],
  [
   "vehicle_rc",
   "Vehicle RC book",
   "वाहन पंजीकरण (RC)",
   "वाहन नोंदणी (RC)"
  ],
  [
   "vehicle_insurance",
   "Vehicle insurance / PUC",
   "वाहन बीमा / PUC",
   "वाहन विमा / PUC"
  ],
  [
   "vehicle_service",
   "Service records & challans",
   "सर्विस रिकॉर्ड और चालान",
   "सर्व्हिस नोंदी आणि चलन"
  ],
  [
   "tickets",
   "Tickets & bookings",
   "टिकट और बुकिंग",
   "तिकिटे आणि बुकिंग"
  ],
  [
   "visa",
   "Visa / travel insurance",
   "वीज़ा / यात्रा बीमा",
   "व्हिसा / प्रवास विमा"
  ]
 ],
 "work": [
  [
   "offer_letter",
   "Offer / appointment letter",
   "ऑफ़र / नियुक्ति पत्र",
   "ऑफर / नियुक्ती पत्र"
  ],
  [
   "salary_slip",
   "Salary slips",
   "वेतन पर्ची",
   "पगार पावती"
  ],
  [
   "experience_letter",
   "Experience / relieving letter",
   "अनुभव / कार्यमुक्ति पत्र",
   "अनुभव / कार्यमुक्ती पत्र"
  ],
  [
   "pf_uan",
   "PF / UAN / ESI details",
   "PF / UAN / ESI विवरण",
   "PF / UAN / ESI तपशील"
  ],
  [
   "resume",
   "Resume / CV",
   "रिज़्यूमे / सीवी",
   "रिझ्युमे / सीव्ही"
  ],
  [
   "appraisal",
   "Appraisal & promotion letters",
   "मूल्यांकन और पदोन्नति पत्र",
   "मूल्यमापन आणि पदोन्नती पत्र"
  ],
  [
   "work_id",
   "Employee ID / background verification",
   "कर्मचारी पहचान पत्र / बैकग्राउंड वेरिफिकेशन",
   "कर्मचारी ओळखपत्र / पार्श्वभूमी पडताळणी"
  ],
  [
   "contract",
   "Contracts / NDAs",
   "अनुबंध / NDA",
   "करारनामे / NDA"
  ],
  [
   "gst_udyam",
   "GST / Udyam / business registration",
   "GST / उद्यम / व्यवसाय पंजीकरण",
   "GST / उद्यम / व्यवसाय नोंदणी"
  ],
  [
   "invoice",
   "Invoices & quotations",
   "चालान (इनवॉइस) और कोटेशन",
   "बिले (इनव्हॉइस) आणि कोटेशन"
  ],
  [
   "trade_licence",
   "Shop Act / trade licences",
   "शॉप एक्ट / व्यापार लाइसेंस",
   "शॉप ॲक्ट / व्यापार परवाने"
  ],
  [
   "partnership",
   "Partnership deed / company papers",
   "साझेदारी विलेख / कंपनी दस्तावेज़",
   "भागीदारी करार / कंपनी कागदपत्रे"
  ],
  [
   "audit",
   "Accounts & audit reports",
   "लेखा और ऑडिट रिपोर्ट",
   "हिशेब आणि ऑडिट अहवाल"
  ]
 ],
 "other": [
  [
   "warranty",
   "Warranty cards & receipts",
   "वारंटी कार्ड और रसीदें",
   "वॉरंटी कार्ड आणि पावत्या"
  ],
  [
   "manual",
   "Manuals & guides",
   "मैनुअल और गाइड",
   "मॅन्युअल आणि मार्गदर्शिका"
  ],
  [
   "membership",
   "Memberships & subscriptions",
   "सदस्यता और सब्सक्रिप्शन",
   "सदस्यत्व आणि सबस्क्रिप्शन"
  ],
  [
   "society_ngo",
   "Society / club / NGO papers",
   "सोसाइटी / क्लब / NGO दस्तावेज़",
   "सोसायटी / क्लब / NGO कागदपत्रे"
  ],
  [
   "notes_forms",
   "Notes, letters & forms",
   "नोट्स, पत्र और फ़ॉर्म",
   "नोट्स, पत्रे आणि अर्ज"
  ],
  [
   "misc",
   "Miscellaneous",
   "विविध",
   "विविध"
  ]
 ]
};

const byKey = {};
for (const group of Object.values(TYPES)) for (const [key, en, hi, mr] of group) byKey[key] = { en, hi, mr };

export const typesFor = (cluster, lang = "en") =>
  (TYPES[cluster] || []).map(([key, en, hi, mr]) => ({ key, label: { en, hi, mr }[lang] || en }));

export const isKnownType = (cluster, key) => (TYPES[cluster] || []).some(([k]) => k === key);

// Known keys are translated; anything the user typed themselves is shown as typed.
export const categoryLabel = (key, lang = "en") => (key && byKey[key] ? byKey[key][lang] || byKey[key].en : key || "");
