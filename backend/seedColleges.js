// Allow MONGO_URI to be passed as CLI arg: node seedColleges.js mongodb+srv://...
if (process.argv[2]) process.env.MONGO_URI = process.argv[2];
require('dns').setServers(['8.8.8.8', '8.8.4.4']); // force Google DNS
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const College = require('./src/models/College');
const connectDB = require('./src/config/db');

// ── Discipline Libraries ──────────────────────────────────────────────────────
const ENG = ['Computer Science','Information Technology','Electronics & Telecommunication','Mechanical Engineering','Civil Engineering','Electrical Engineering','Chemical Engineering','Biotechnology','AIDS (AI & Data Science)','EXTC'];
const MGMT = ['MBA - Marketing','MBA - Finance','MBA - Human Resources','MBA - Operations','MBA - Business Analytics','MBA - International Business','MBA - Entrepreneurship'];
const ARTS = ['Economics','English Literature','History','Political Science','Sociology','Psychology','Journalism & Mass Communication','Geography','Philosophy'];
const COMMERCE = ['B.Com General','B.Com (Accounting & Finance)','B.Com (Banking & Insurance)','B.Com (Financial Markets)','Business Management Studies','M.Com'];
const LAW = ['BA LLB (5-Year Integrated)','BBA LLB (5-Year Integrated)','LLB (3-Year)','LLM','Corporate Law','Intellectual Property Law'];
const MEDICAL = ['MBBS','MD - General Medicine','MS - Surgery','B.Sc Nursing','M.Sc Nursing','BDS','BPT (Physiotherapy)','B.Pharm'];
const SCIENCE = ['Physics','Chemistry','Mathematics','Computer Science (B.Sc)','Biotechnology (B.Sc)','Microbiology','Statistics'];
const DESIGN = [
  'Product Design','Communication Design','Graphic Design','Textile & Fashion Design',
  'Animation & VFX','UX Design & Interaction Design','Architecture (B.Arch)',
  'Interior Design','Jewellery Design','Industrial Design','Game Design',
  'Photography','Film & Video Production','Motion Graphics','UI/UX Design',
  'Furniture Design','Ceramic & Glass Design','Leather Design','Toy Design',
  'New Media Design','Design Thinking & Innovation',
];

const colleges = [
  // ── PUNE — Engineering ───────────────────────────────────────────────────
  {
    name:'Pune Institute of Computer Technology', slug:'pict', code:'PICT',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@pict.edu', password:'PICT@Drive2025',
    address:'Survey No. 27, Dhankawadi, Pune - 411043',
    phone:'+91 20 2437 1101', website:'https://pict.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@pict.edu', phone:'+91 9876543210' },
    disciplines:['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'AI & Data Science'],
  },
  {
    name:'College of Engineering Pune', slug:'coep', code:'COEP',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@coep.org.in', password:'COEP@Drive2025',
    address:'Wellesley Rd, Shivajinagar, Pune - 411005',
    phone:'+91 20 2550 7000', website:'https://coep.org.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@coep.org.in', phone:'+91 9876543211' },
    disciplines:['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Instrumentation Engineering', 'Production Engineering', 'Metallurgy'],
  },
  {
    name:'Vishwakarma Institute of Technology', slug:'vit-pune', code:'VITPUNE',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@vit.edu', password:'VIT@Drive2025',
    address:'666, Upper Indiranagar, Bibwewadi, Pune - 411037',
    phone:'+91 20 2440 2800', website:'https://vit.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@vit.edu', phone:'+91 9876543212' },
    disciplines:['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Chemical Engineering', 'Instrumentation Engineering', 'Industrial Engineering', 'AI & Data Science'],
  },
  {
    name:'MIT World Peace University', slug:'mit-wpu', code:'MITWPU',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@mitwpu.edu.in', password:'MITWPU@Drive2025',
    address:'Survey No. 124, Paud Road, Kothrud, Pune - 411038',
    phone:'+91 20 7117 7104', website:'https://mitwpu.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@mitwpu.edu.in', phone:'+91 9876543213' },
    disciplines:[...ENG, ...MGMT],
  },
  {
    name:'MIT College of Engineering, Alandi', slug:'mit-alandi', code:'MITALANDI',
    type:'ENGINEERING', university:'SPPU', city:'Alandi', state:'Maharashtra',
    email:'tpo@mitcoe.edu.in', password:'MITALANDI@Drive2025',
    address:'Alandi (D), Pune - 412105',
    phone:'+91 20 2700 0000', website:'https://mitcoe.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@mitcoe.edu.in', phone:'+91 9876543214' },
    disciplines:[...ENG],
  },
  {
    name:'D Y Patil College of Engineering', slug:'dypatil-pune', code:'DYPATIL',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@dypatilpune.ac.in', password:'DYPATIL@Drive2025',
    address:'Ambi, Talegaon-Dabhade, Pune - 410506',
    phone:'+91 2114 669 100', website:'https://dypatilpune.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@dypatilpune.ac.in', phone:'+91 9876543216' },
    disciplines:[...ENG],
  },
  {
    name:'Symbiosis Institute of Technology', slug:'sit-pune', code:'SIT',
    type:'ENGINEERING', university:'Symbiosis International University', city:'Pune', state:'Maharashtra',
    email:'tpo@sitpune.edu.in', password:'SIT@Drive2025',
    address:'Gram: Lavale, Tal: Mulshi, Pune - 412115',
    phone:'+91 20 3911 6200', website:'https://sitpune.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@sitpune.edu.in', phone:'+91 9876543217' },
    disciplines:['Computer Science', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering', 'AI & Data Science', 'Robotics & Automation'],
  },
  {
    name: 'Sinhgad College of Engineering', slug: 'scoe-pune', code: 'SCOE',
    type: 'ENGINEERING', university: 'SPPU', city: 'Pune', state: 'Maharashtra',
    email: 'tpo@sinhgad.edu', password: 'SCOE@Drive2025',
    address: 'Vadgaon (Bk), Pune - 411041', phone: '+91 20 2435 4705', website: 'https://sinhgad.edu',
    tpo: { name: 'Training & Placement Officer', email: 'tpo@sinhgad.edu', phone: '+91 9876543240' },
    disciplines: ['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Production Engineering', 'Biotechnology']
  },
  {
    name:'Marathwada Mitra Mandal\'s College of Engineering', slug:'mmcoe', code:'MMCOE',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@mmcoe.edu.in', password:'MMCOE@Drive2025',
    address:'Karvenagar, Pune - 411052',
    phone:'+91 20 2547 3160', website:'https://mmcoe.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@mmcoe.edu.in', phone:'+91 9876543201' },
    disciplines:['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Electrical Engineering', 'AI & Data Science'],
  },
  {
    name:'Pimpri Chinchwad College of Engineering', slug:'pccoe', code:'PCCOE',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@pccoepune.org', password:'PCCOE@Drive2025',
    address:'Sector-26, Pradhikaran, Nigdi, Pimpri-Chinchwad, Pune - 411044',
    phone:'+91 20 2765 3168', website:'https://pccoepune.com',
    tpo:{ name:'Training & Placement Officer', email:'tpo@pccoepune.org', phone:'+91 9876543202' },
    disciplines:['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering', 'AI & Machine Learning'],
  },
  {
    name:'Pimpri Chinchwad College of Engineering and Research', slug:'pccoer', code:'PCCOER',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@pccoer.org', password:'PCCOER@Drive2025',
    address:'Ravet, Pune - 412101',
    phone:'+91 20 2765 3168', website:'https://pccoer.com',
    tpo:{ name:'Training & Placement Officer', email:'tpo@pccoer.org', phone:'+91 9876543203' },
    disciplines:['Computer Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Electronics & Telecommunication'],
  },
  {
    name:'Dr. D. Y. Patil Institute of Technology', slug:'dypatil-pimpri', code:'DYPIOT',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@dypit.edu.in', password:'DYPIT@Drive2025',
    address:'Sant Tukaram Nagar, Pimpri, Pune - 411018',
    phone:'+91 20 2742 1095', website:'https://engg.dypvp.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@dypit.edu.in', phone:'+91 9876543204' },
    disciplines:['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering', 'AI & Data Science', 'Instrumentation Engineering', 'Electrical Engineering'],
  },
  {
    name:'D. Y. Patil College of Engineering', slug:'dypatil-akurdi', code:'DYPCOE',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@dypcoeakurdi.ac.in', password:'DYPCOE@Drive2025',
    address:'Sector 29, Nigdi Pradhikaran, Akurdi, Pune - 411044',
    phone:'+91 20 2765 3054', website:'https://dypcoeakurdi.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@dypcoeakurdi.ac.in', phone:'+91 9876543205' },
    disciplines:['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering', 'AI & Data Science', 'Robotics & Automation'],
  },
  {
    name:'Deccan Education Society\'s Pune University', slug:'des-pune', code:'DES',
    type:'UNIVERSITY', university:'DES Pune University', city:'Pune', state:'Maharashtra',
    email:'tpo@despune.edu.in', password:'DES@Drive2025',
    address:'Fergusson College Campus, Shivajinagar, Pune - 411004',
    phone:'+91 20 2565 4254', website:'https://despune.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@despune.edu.in', phone:'+91 9876543206' },
    disciplines:[...ENG, ...MGMT, ...ARTS, ...COMMERCE, ...SCIENCE],
  },
  {
    name:'Symbiosis Institute of Computer Studies and Research', slug:'sicsr', code:'SICSR',
    type:'ARTS_SCIENCE', university:'Symbiosis International University', city:'Pune', state:'Maharashtra',
    email:'tpo@sicsr.ac.in', password:'SICSR@Drive2025',
    address:'Atur Centre, Gokhale Cross Road, Model Colony, Pune - 411016',
    phone:'+91 20 2567 5601', website:'https://sicsr.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@sicsr.ac.in', phone:'+91 9876543207' },
    disciplines:['Computer Applications (BCA)', 'BBA (IT)', 'M.Sc (CA)', 'M.Sc (SS)'],
  },
  {
    name:'Vishwakarma Institute of Information Technology', slug:'viit', code:'VIIT',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@viit.ac.in', password:'VIIT@Drive2025',
    address:'Survey No. 2/3/4, Kondhwa (Bk), Pune - 411048',
    phone:'+91 20 2695 0200', website:'https://viit.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@viit.ac.in', phone:'+91 9876543209' },
    disciplines:['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Civil Engineering', 'AI & Data Science'],
  },
  {
    name: 'Cummins College of Engineering for Women', slug: 'cummins', code: 'CCOEW',
    type: 'ENGINEERING', university: 'SPPU', city: 'Pune', state: 'Maharashtra',
    email: 'tpo@cumminscollege.edu', password: 'CCOEW@Drive2025',
    address: 'Karvenagar, Pune - 411052', phone: '+91 20 2531 1000', website: 'https://cumminscollege.org',
    tpo: { name: 'Training & Placement Officer', email: 'tpo@cumminscollege.edu', phone: '+91 9876543230' },
    disciplines: ['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Mechanical Engineering', 'Instrumentation Engineering']
  },
  {
    name: 'AISSMS College of Engineering', slug: 'aissms-coe', code: 'AISSMSCOE',
    type: 'ENGINEERING', university: 'SPPU', city: 'Pune', state: 'Maharashtra',
    email: 'tpo@aissmscoe.com', password: 'AISSMS@Drive2025',
    address: 'Kennedy Road, Pune - 411001', phone: '+91 20 2605 7660', website: 'https://aissmscoe.com',
    tpo: { name: 'Training & Placement Officer', email: 'tpo@aissmscoe.com', phone: '+91 9876543231' },
    disciplines: ['Computer Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Electrical Engineering', 'Production Engineering']
  },
  {
    name: 'AISSMS Institute of Information Technology', slug: 'aissms-ioit', code: 'AISSMSIOIT',
    type: 'ENGINEERING', university: 'SPPU', city: 'Pune', state: 'Maharashtra',
    email: 'tpo@aissmsioit.org', password: 'AISSMS@Drive2025',
    address: 'Kennedy Road, Pune - 411001', phone: '+91 20 2605 7983', website: 'https://aissmsioit.org',
    tpo: { name: 'Training & Placement Officer', email: 'tpo@aissmsioit.org', phone: '+91 9876543232' },
    disciplines: ['Computer Engineering', 'Information Technology', 'Electronics & Telecommunication', 'Instrumentation Engineering', 'Electrical Engineering', 'AI & Data Science']
  },
  {
    name: 'Modern Education Society\'s College of Engineering', slug: 'mescoe', code: 'MESCOE',
    type: 'ENGINEERING', university: 'SPPU', city: 'Pune', state: 'Maharashtra',
    email: 'tpo@mescoepune.org', password: 'MESCOE@Drive2025',
    address: 'Wadia College Campus, Pune - 411001', phone: '+91 20 2616 3831', website: 'https://mescoepune.org',
    tpo: { name: 'Training & Placement Officer', email: 'tpo@mescoepune.org', phone: '+91 9876543233' },
    disciplines: ['Computer Engineering', 'Electronics & Telecommunication', 'Mechanical Engineering']
  },
  // ── PUNE — Management ────────────────────────────────────────────────────
  {
    name:'Symbiosis Institute of Business Management', slug:'sibm-pune', code:'SIBM',
    type:'MANAGEMENT', university:'Symbiosis International University', city:'Pune', state:'Maharashtra',
    email:'tpo@sibmpune.edu.in', password:'SIBM@Drive2025',
    address:'Symbiosis Infotech Campus, Plot No. 15, Rajiv Gandhi IT Park, Hinjewadi, Pune - 411057',
    phone:'+91 20 3911 6200', website:'https://sibmpune.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@sibmpune.edu.in', phone:'+91 9876543218' },
    disciplines:[...MGMT],
  },
  // ── PUNE — Arts/Commerce ─────────────────────────────────────────────────
  {
    name:'Fergusson College', slug:'fergusson', code:'FERG',
    type:'ARTS_SCIENCE', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@fergusson.edu', password:'FERG@Drive2025',
    address:'Fergusson College Road, Shivajinagar, Pune - 411004',
    phone:'+91 20 2565 3988', website:'https://fergusson.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@fergusson.edu', phone:'+91 9876543219' },
    disciplines:[...ARTS, ...SCIENCE, ...COMMERCE],
  },
  {
    name:'Brihan Maharashtra College of Commerce', slug:'bmcc', code:'BMCC',
    type:'ARTS_SCIENCE', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@bmcc.ac.in', password:'BMCC@Drive2025',
    address:'Shivajinagar, Pune - 411005',
    phone:'+91 20 2553 4427', website:'https://bmcc.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@bmcc.ac.in', phone:'+91 9876543220' },
    disciplines:[...COMMERCE, 'Business Administration (BBA)', 'Computer Applications (BCA)'],
  },
  // ── PUNE — Law ───────────────────────────────────────────────────────────
  {
    name:'ILS Law College', slug:'ils-pune', code:'ILS',
    type:'LAW', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@ilslaw.edu', password:'ILS@Drive2025',
    address:'Law College Road, Pune - 411004',
    phone:'+91 20 2565 6775', website:'https://ilslaw.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@ilslaw.edu', phone:'+91 9876543221' },
    disciplines:[...LAW],
  },
  // ── MUMBAI — Engineering ─────────────────────────────────────────────────
  {
    name:'Sardar Patel Institute of Technology', slug:'spit', code:'SPIT',
    type:'ENGINEERING', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@spit.ac.in', password:'SPIT@Drive2025',
    address:"Bhavans Campus, Munshi Nagar, Andheri (W), Mumbai - 400058",
    phone:'+91 22 2670 3541', website:'https://spit.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@spit.ac.in', phone:'+91 9876543222' },
    disciplines:['Computer Engineering','Electronics & Telecommunication','Information Technology','Mechanical Engineering'],
  },
  {
    name:"Vivekanand Education Society's Institute of Technology", slug:'vesit', code:'VESIT',
    type:'ENGINEERING', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@vesit.ves.ac.in', password:'VESIT@Drive2025',
    address:'Chembur, Mumbai - 400074',
    phone:'+91 22 2522 0838', website:'https://vesit.ves.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@vesit.ves.ac.in', phone:'+91 9876543223' },
    disciplines:[...ENG],
  },
  {
    name:'Dwarkadas J. Sanghvi College of Engineering', slug:'djsanghvi', code:'DJSANGHVI',
    type:'ENGINEERING', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@djsanghvi.ac.in', password:'DJSANGHVI@Drive2025',
    address:'Bhaktivedanta Swami Marg, Vile Parle (W), Mumbai - 400056',
    phone:'+91 22 2614 1949', website:'https://djsanghvi.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@djsanghvi.ac.in', phone:'+91 9876543224' },
    disciplines:['Computer Engineering','Electronics & Telecommunication','Information Technology','Mechanical Engineering','AIDS (AI & Data Science)'],
  },
  {
    name:'Veermata Jijabai Technological Institute', slug:'vjti', code:'VJTI',
    type:'ENGINEERING', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@vjti.ac.in', password:'VJTI@Drive2025',
    address:'H R Mahajani Marg, Matunga, Mumbai - 400019',
    phone:'+91 22 2419 8101', website:'https://vjti.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@vjti.ac.in', phone:'+91 9876543225' },
    disciplines:[...ENG, 'Production Engineering','Textile Technology'],
  },
  {
    name:'K.J. Somaiya College of Engineering', slug:'kjsieit', code:'KJSIEIT',
    type:'ENGINEERING', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@kjsieit.somaiya.edu', password:'KJSIEIT@Drive2025',
    address:'Sion (E), Mumbai - 400022',
    phone:'+91 22 6728 3100', website:'https://kjsieit.somaiya.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@kjsieit.somaiya.edu', phone:'+91 9876543226' },
    disciplines:[...ENG],
  },
  // ── MUMBAI — Management ──────────────────────────────────────────────────
  {
    name:'Jamnalal Bajaj Institute of Management Studies', slug:'jbims', code:'JBIMS',
    type:'MANAGEMENT', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@jbims.edu', password:'JBIMS@Drive2025',
    address:'164, Backbay Reclamation, Churchgate, Mumbai - 400020',
    phone:'+91 22 2202 1313', website:'https://jbims.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@jbims.edu', phone:'+91 9876543227' },
    disciplines:[...MGMT],
  },
  {
    name:'S.P. Jain Institute of Management and Research', slug:'spjimr', code:'SPJIMR',
    type:'MANAGEMENT', university:'Autonomous', city:'Mumbai', state:'Maharashtra',
    email:'tpo@spjimr.org', password:'SPJIMR@Drive2025',
    address:'Munshi Nagar, Dadabhai Road, Andheri (W), Mumbai - 400058',
    phone:'+91 22 6629 1515', website:'https://spjimr.org',
    tpo:{ name:'Training & Placement Officer', email:'tpo@spjimr.org', phone:'+91 9876543228' },
    disciplines:[...MGMT, 'PGDM - Global Management','Family Managed Business'],
  },
  // ── MUMBAI — Arts/Commerce ───────────────────────────────────────────────
  {
    name:"St. Xavier's College Mumbai", slug:'xavier-mumbai', code:'XAVIERMUM',
    type:'ARTS_SCIENCE', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@xaviers.edu', password:'XAVIER@Drive2025',
    address:'5, Mahapalika Marg, Mumbai - 400001',
    phone:'+91 22 2262 0661', website:'https://xaviers.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@xaviers.edu', phone:'+91 9876543229' },
    disciplines:[...ARTS, ...SCIENCE, ...COMMERCE],
  },
  {
    name:'H.R. College of Commerce & Economics', slug:'hr-college', code:'HRCOLLEGE',
    type:'ARTS_SCIENCE', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@hrcollege.edu', password:'HRCOLLEGE@Drive2025',
    address:'Vidyanagari, Churchgate, Mumbai - 400020',
    phone:'+91 22 2203 5765', website:'https://hrcollege.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@hrcollege.edu', phone:'+91 9876543230' },
    disciplines:[...COMMERCE],
  },
  // ── DELHI ────────────────────────────────────────────────────────────────
  {
    name:'Indian Institute of Technology Delhi', slug:'iit-delhi', code:'IITD',
    type:'ENGINEERING', university:'IIT Delhi (Autonomous)', city:'Delhi', state:'Delhi',
    email:'tpo@iitd.ac.in', password:'IITD@Drive2025',
    address:'Hauz Khas, New Delhi - 110016',
    phone:'+91 11 2659 1000', website:'https://iitd.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@iitd.ac.in', phone:'+91 9876543231' },
    disciplines:['Computer Science','Electrical Engineering','Mechanical Engineering','Civil Engineering','Chemical Engineering','Mathematics & Computing','Engineering Physics','Biotechnology'],
  },
  {
    name:'Delhi Technological University', slug:'dtu', code:'DTU',
    type:'ENGINEERING', university:'DTU (Autonomous)', city:'Delhi', state:'Delhi',
    email:'tpo@dtu.ac.in', password:'DTU@Drive2025',
    address:'Shahbad Daulatpur, Main Bawana Road, Delhi - 110042',
    phone:'+91 11 2787 1018', website:'https://dtu.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@dtu.ac.in', phone:'+91 9876543232' },
    disciplines:['Computer Science','Electronics & Communication','Electrical Engineering','Mechanical Engineering','Civil Engineering','Biotechnology','Information Technology','Environmental Engineering'],
  },
  {
    name:'Shri Ram College of Commerce', slug:'srcc', code:'SRCC',
    type:'ARTS_SCIENCE', university:'Delhi University', city:'Delhi', state:'Delhi',
    email:'tpo@srcc.du.ac.in', password:'SRCC@Drive2025',
    address:'Maurice Nagar, Delhi - 110007',
    phone:'+91 11 2766 7905', website:'https://srcc.du.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@srcc.du.ac.in', phone:'+91 9876543233' },
    disciplines:['B.Com (Hons.)','B.A. (Hons.) Economics','M.Com','MBA - Global Business Operations'],
  },
  {
    name:'Faculty of Management Studies Delhi', slug:'fms-delhi', code:'FMSD',
    type:'MANAGEMENT', university:'Delhi University', city:'Delhi', state:'Delhi',
    email:'tpo@fms.edu', password:'FMSD@Drive2025',
    address:'University Enclave, Delhi - 110007',
    phone:'+91 11 2766 6382', website:'https://fms.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@fms.edu', phone:'+91 9876543234' },
    disciplines:[...MGMT],
  },
  // ── BENGALURU ────────────────────────────────────────────────────────────
  {
    name:'R.V. College of Engineering', slug:'rvce', code:'RVCE',
    type:'ENGINEERING', university:'VTU', city:'Bengaluru', state:'Karnataka',
    email:'tpo@rvce.edu.in', password:'RVCE@Drive2025',
    address:'RV Vidyaniketan Post, Mysore Road, Bengaluru - 560059',
    phone:'+91 80 6717 8000', website:'https://rvce.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@rvce.edu.in', phone:'+91 9876543235' },
    disciplines:[...ENG, 'Industrial Engineering & Management'],
  },
  {
    name:'IIM Bengaluru', slug:'iim-bengaluru', code:'IIMB',
    type:'MANAGEMENT', university:'IIM Bengaluru (Autonomous)', city:'Bengaluru', state:'Karnataka',
    email:'tpo@iimb.ac.in', password:'IIMB@Drive2025',
    address:'Bannerghatta Road, Bengaluru - 560076',
    phone:'+91 80 2699 3000', website:'https://iimb.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@iimb.ac.in', phone:'+91 9876543236' },
    disciplines:[...MGMT, 'PGPBA - Business Analytics','MBA - Public Policy'],
  },
  {
    name:'National Law School of India University', slug:'nlsiu', code:'NLSIU',
    type:'LAW', university:'NLSIU (Autonomous)', city:'Bengaluru', state:'Karnataka',
    email:'tpo@nls.ac.in', password:'NLSIU@Drive2025',
    address:"Nagarbhavi, Bengaluru - 560072",
    phone:'+91 80 2316 0532', website:'https://nls.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@nls.ac.in', phone:'+91 9876543237' },
    disciplines:[...LAW],
  },
  // ── HYDERABAD ────────────────────────────────────────────────────────────
  {
    name:'IIIT Hyderabad', slug:'iiit-hyd', code:'IIITH',
    type:'ENGINEERING', university:'IIIT Hyderabad (Autonomous)', city:'Hyderabad', state:'Telangana',
    email:'tpo@iiit.ac.in', password:'IIITH@Drive2025',
    address:'Gachibowli, Hyderabad - 500032',
    phone:'+91 40 6653 1000', website:'https://iiit.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@iiit.ac.in', phone:'+91 9876543238' },
    disciplines:['Computer Science','Electronics & Communication','Computational Linguistics','Cognitive Science','AIDS (AI & Data Science)'],
  },
  {
    name:'Indian School of Business', slug:'isb-hyd', code:'ISB',
    type:'MANAGEMENT', university:'ISB (Autonomous)', city:'Hyderabad', state:'Telangana',
    email:'tpo@isb.edu', password:'ISB@Drive2025',
    address:'Gachibowli, Hyderabad - 500111',
    phone:'+91 40 2318 7000', website:'https://isb.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@isb.edu', phone:'+91 9876543239' },
    disciplines:['Post Graduate Programme (PGP - MBA)','Executive Education','MBA - Finance','MBA - Strategy & Leadership','MBA - Entrepreneurship','MBA - Marketing'],
  },
  {
    name:'NALSAR University of Law', slug:'nalsar', code:'NALSAR',
    type:'LAW', university:'NALSAR (Autonomous)', city:'Hyderabad', state:'Telangana',
    email:'tpo@nalsar.ac.in', password:'NALSAR@Drive2025',
    address:'Justice City, Shameerpet, Hyderabad - 500101',
    phone:'+91 40 2349 8100', website:'https://nalsar.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@nalsar.ac.in', phone:'+91 9876543240' },
    disciplines:[...LAW],
  },
  // ── CHENNAI ──────────────────────────────────────────────────────────────
  {
    name:'Indian Institute of Technology Madras', slug:'iit-madras', code:'IITM',
    type:'ENGINEERING', university:'IIT Madras (Autonomous)', city:'Chennai', state:'Tamil Nadu',
    email:'tpo@iitm.ac.in', password:'IITM@Drive2025',
    address:'IIT Post Office, Chennai - 600036',
    phone:'+91 44 2257 8000', website:'https://iitm.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@iitm.ac.in', phone:'+91 9876543241' },
    disciplines:['Computer Science','Electrical Engineering','Mechanical Engineering','Civil Engineering','Chemical Engineering','Aerospace Engineering','Ocean Engineering','Biotechnology','Engineering Design','Mathematics'],
  },
  {
    name:'Loyola College Chennai', slug:'loyola-chennai', code:'LOYOLACHEN',
    type:'ARTS_SCIENCE', university:'University of Madras', city:'Chennai', state:'Tamil Nadu',
    email:'tpo@loyolacollege.edu', password:'LOYOLA@Drive2025',
    address:'Nungambakkam, Chennai - 600034',
    phone:'+91 44 2817 8200', website:'https://loyolacollege.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@loyolacollege.edu', phone:'+91 9876543242' },
    disciplines:[...ARTS, ...SCIENCE, ...COMMERCE, 'BCA','BBA'],
  },
  // ── AHMEDABAD ────────────────────────────────────────────────────────────
  {
    name:'IIM Ahmedabad', slug:'iim-ahmedabad', code:'IIMA',
    type:'MANAGEMENT', university:'IIM Ahmedabad (Autonomous)', city:'Ahmedabad', state:'Gujarat',
    email:'tpo@iima.ac.in', password:'IIMA@Drive2025',
    address:'Vastrapur, Ahmedabad - 380015',
    phone:'+91 79 6632 4000', website:'https://iima.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@iima.ac.in', phone:'+91 9876543243' },
    disciplines:[...MGMT,'PGPX - Executive MBA','MBA - Food & Agribusiness','MBA - Public Policy'],
  },
  {
    name:'National Institute of Design Ahmedabad', slug:'nid-ahmedabad', code:'NID',
    type:'DESIGN', university:'NID (Autonomous)', city:'Ahmedabad', state:'Gujarat',
    email:'tpo@nid.edu', password:'NID@Drive2025',
    address:'Paldi, Ahmedabad - 380007',
    phone:'+91 79 2662 9500', website:'https://nid.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@nid.edu', phone:'+91 9876543244' },
    disciplines:[...DESIGN],
  },
  {
    name:'L.D. College of Engineering', slug:'ldce', code:'LDCE',
    type:'ENGINEERING', university:'Gujarat Technological University', city:'Ahmedabad', state:'Gujarat',
    email:'tpo@ldce.ac.in', password:'LDCE@Drive2025',
    address:'Navrangpura, Ahmedabad - 380015',
    phone:'+91 79 2630 1428', website:'https://ldce.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@ldce.ac.in', phone:'+91 9876543245' },
    disciplines:[...ENG],
  },

  // ── PUNE — Design (MIT-ADT) ──────────────────────────────────────────────
  {
    name:'MIT Art, Design and Technology University', slug:'mit-adt', code:'MITADT',
    type:'DESIGN', university:'MIT-ADT University', city:'Pune', state:'Maharashtra',
    email:'tpo@mitadt.edu.in', password:'MITADT@Drive2025',
    address:'Rajbaug, Loni Kalbhor, Pune - 412201',
    phone:'+91 20 3071 7000', website:'https://mitadt.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@mitadt.edu.in', phone:'+91 9876543250' },
    disciplines:[
      'Product Design','Communication Design','Graphic Design','Animation & VFX',
      'Interior Design','Industrial Design','UI/UX Design','Fashion Design',
      'Game Design','Film & Video Production','Architecture (B.Arch)',
      'Design Thinking & Innovation','Textile & Fashion Design',
    ],
  },
  {
    name:'Symbiosis School of Design', slug:'ssd-pune', code:'SSD',
    type:'DESIGN', university:'Symbiosis International University', city:'Pune', state:'Maharashtra',
    email:'tpo@ssd.edu.in', password:'SSD@Drive2025',
    address:'Gram Lavale, Tal Mulshi, Pune - 412115',
    phone:'+91 20 3911 6300', website:'https://ssd.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@ssd.edu.in', phone:'+91 9876543251' },
    disciplines:['Communication Design','Product Design','Graphic Design','Interior Design','UI/UX Design','Fashion Design'],
  },

  // ── PUNE — Engineering (more) ────────────────────────────────────────────
  {
    name:'Maharashtra Institute of Technology', slug:'mit-pune', code:'MITPUNE',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@mitpune.edu.in', password:'MITPUNE@Drive2025',
    address:'S. No. 124, Paud Road, Kothrud, Pune - 411038',
    phone:'+91 20 2540 3100', website:'https://mitpune.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@mitpune.edu.in', phone:'+91 9876543252' },
    disciplines:[...ENG],
  },
  {
    name:'Indira College of Engineering and Management', slug:'icem-pune', code:'ICEM',
    type:'ENGINEERING', university:'SPPU', city:'Pune', state:'Maharashtra',
    email:'tpo@icem.edu.in', password:'ICEM@Drive2025',
    address:'Parandwadi, Pune - 410506',
    phone:'+91 2114 661 800', website:'https://icem.edu.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@icem.edu.in', phone:'+91 9876543253' },
    disciplines:['Computer Science','Information Technology','Mechanical Engineering','Civil Engineering','EXTC'],
  },
  // ── MUMBAI — Design ──────────────────────────────────────────────────────
  {
    name:'Pearl Academy Mumbai', slug:'pearl-mumbai', code:'PEARLMUM',
    type:'DESIGN', university:'Pearl Academy (Autonomous)', city:'Mumbai', state:'Maharashtra',
    email:'tpo@pearlacademy.com', password:'PEARL@Drive2025',
    address:'Andheri West, Mumbai - 400058',
    phone:'+91 22 6158 2525', website:'https://pearlacademy.com',
    tpo:{ name:'Training & Placement Officer', email:'tpo@pearlacademy.com', phone:'+91 9876543255' },
    disciplines:['Fashion Design','Textile & Fashion Design','Communication Design','Graphic Design','Interior Design','Jewellery Design','Leather Design'],
  },
  {
    name:'Rachana Sansad School of Design', slug:'rssd-mumbai', code:'RSSD',
    type:'DESIGN', university:'Mumbai University', city:'Mumbai', state:'Maharashtra',
    email:'tpo@rssd.edu', password:'RSSD@Drive2025',
    address:'Sir J.J. Road, Byculla, Mumbai - 400008',
    phone:'+91 22 2373 6282', website:'https://rssd.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@rssd.edu', phone:'+91 9876543256' },
    disciplines:['Product Design','Graphic Design','Communication Design','Animation & VFX','Interior Design','Industrial Design'],
  },
  {
    name:'Whistling Woods International', slug:'wwi-mumbai', code:'WWI',
    type:'DESIGN', university:'Whistling Woods (Autonomous)', city:'Mumbai', state:'Maharashtra',
    email:'tpo@whistlingwoods.net', password:'WWI@Drive2025',
    address:'Film City Complex, Goregaon East, Mumbai - 400065',
    phone:'+91 22 2840 1232', website:'https://whistlingwoods.net',
    tpo:{ name:'Training & Placement Officer', email:'tpo@whistlingwoods.net', phone:'+91 9876543257' },
    disciplines:['Film & Video Production','Motion Graphics','Photography','Communication Design','Game Design'],
  },

  // ── BENGALURU — Design ───────────────────────────────────────────────────
  {
    name:'Srishti Manipal Institute of Art, Design and Technology', slug:'srishti-bengaluru', code:'SRISHTI',
    type:'DESIGN', university:'Manipal Academy of Higher Education', city:'Bengaluru', state:'Karnataka',
    email:'tpo@srishti.ac.in', password:'SRISHTI@Drive2025',
    address:'Yelahanka, Bengaluru - 560064',
    phone:'+91 80 4624 0000', website:'https://srishti.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@srishti.ac.in', phone:'+91 9876543258' },
    disciplines:['Product Design','Communication Design','Graphic Design','Animation & VFX','UX Design & Interaction Design','Game Design','New Media Design','Photography','Film & Video Production','Textile & Fashion Design','Design Thinking & Innovation'],
  },
  {
    name:'M.S. Ramaiah Institute of Technology', slug:'msrit', code:'MSRIT',
    type:'ENGINEERING', university:'VTU', city:'Bengaluru', state:'Karnataka',
    email:'tpo@msrit.edu', password:'MSRIT@Drive2025',
    address:'MSR Nagar, MSRIT Post, Bengaluru - 560054',
    phone:'+91 80 2360 0822', website:'https://msrit.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@msrit.edu', phone:'+91 9876543259' },
    disciplines:[...ENG, 'Industrial Engineering & Management','Medical Electronics'],
  },
  {
    name:'PES University', slug:'pes-bengaluru', code:'PESU',
    type:'ENGINEERING', university:'PES University (Autonomous)', city:'Bengaluru', state:'Karnataka',
    email:'tpo@pes.edu', password:'PESU@Drive2025',
    address:'100 Feet Ring Road, BSK III Stage, Bengaluru - 560085',
    phone:'+91 80 2672 0886', website:'https://pes.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@pes.edu', phone:'+91 9876543260' },
    disciplines:[...ENG, 'Robotics & AI','Mechatronics'],
  },

  // ── DELHI — Design ───────────────────────────────────────────────────────
  {
    name:'National Institute of Fashion Technology Delhi', slug:'nift-delhi', code:'NIFTD',
    type:'DESIGN', university:'NIFT (Autonomous)', city:'Delhi', state:'Delhi',
    email:'tpo@nift.ac.in', password:'NIFTD@Drive2025',
    address:'Hauz Khas, New Delhi - 110016',
    phone:'+91 11 2654 9100', website:'https://nift.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@nift.ac.in', phone:'+91 9876543261' },
    disciplines:['Fashion Design','Textile & Fashion Design','Leather Design','Jewellery Design','Knitwear Design','Accessory Design','Fashion Management','Fashion Communication'],
  },
  {
    name:'Pearl Academy Delhi', slug:'pearl-delhi', code:'PEARLDEL',
    type:'DESIGN', university:'Pearl Academy (Autonomous)', city:'Delhi', state:'Delhi',
    email:'tpo@pearl-delhi.edu', password:'PEARLDEL@Drive2025',
    address:'Naraina, New Delhi - 110028',
    phone:'+91 11 4512 4100', website:'https://pearlacademy.com',
    tpo:{ name:'Training & Placement Officer', email:'tpo@pearl-delhi.edu', phone:'+91 9876543262' },
    disciplines:['Fashion Design','Interior Design','Graphic Design','Communication Design','Textile & Fashion Design'],
  },
  {
    name:'Netaji Subhas University of Technology', slug:'nsut', code:'NSUT',
    type:'ENGINEERING', university:'NSUT (Autonomous)', city:'Delhi', state:'Delhi',
    email:'tpo@nsut.ac.in', password:'NSUT@Drive2025',
    address:'Sector 3, Dwarka, New Delhi - 110078',
    phone:'+91 11 2530 6100', website:'https://nsut.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@nsut.ac.in', phone:'+91 9876543263' },
    disciplines:['Computer Science','Electronics & Communication','Information Technology','Mechanical Engineering','Electrical Engineering','AIDS (AI & Data Science)'],
  },

  // ── AHMEDABAD — Design (more NID) ────────────────────────────────────────
  {
    name:'National Institute of Design — Andhra Pradesh', slug:'nid-ap', code:'NIDAP',
    type:'DESIGN', university:'NID (Autonomous)', city:'Amravati', state:'Andhra Pradesh',
    email:'tpo@nidap.ac.in', password:'NIDAP@Drive2025',
    address:'Amaravati, Andhra Pradesh - 522503',
    phone:'+91 863 222 5100', website:'https://nidap.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@nidap.ac.in', phone:'+91 9876543264' },
    disciplines:[...DESIGN],
  },

  // ── CHENNAI — Engineering & Design ───────────────────────────────────────
  {
    name:'Anna University', slug:'anna-univ', code:'ANNAU',
    type:'ENGINEERING', university:'Anna University', city:'Chennai', state:'Tamil Nadu',
    email:'tpo@annauniv.edu', password:'ANNAU@Drive2025',
    address:'Sardar Patel Road, Guindy, Chennai - 600025',
    phone:'+91 44 2235 8500', website:'https://annauniv.edu',
    tpo:{ name:'Training & Placement Officer', email:'tpo@annauniv.edu', phone:'+91 9876543265' },
    disciplines:[...ENG, 'Geo-Informatics','Marine Engineering','Aerospace Engineering'],
  },
  {
    name:'National Institute of Fashion Technology Chennai', slug:'nift-chennai', code:'NIFTCH',
    type:'DESIGN', university:'NIFT (Autonomous)', city:'Chennai', state:'Tamil Nadu',
    email:'tpo@nift-chennai.ac.in', password:'NIFTCH@Drive2025',
    address:'Taramani, Chennai - 600113',
    phone:'+91 44 2245 6100', website:'https://nift.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@nift-chennai.ac.in', phone:'+91 9876543266' },
    disciplines:['Fashion Design','Textile & Fashion Design','Knitwear Design','Fashion Management','Fashion Communication','Accessory Design'],
  },
  {
    name:'Vellore Institute of Technology', slug:'vit-vellore', code:'VITVELLORE',
    type:'ENGINEERING', university:'VIT (Deemed)', city:'Vellore', state:'Tamil Nadu',
    email:'tpo@vit.edu.in', password:'VITVEL@Drive2025',
    address:'Vellore Campus, Tiruvalam Rd, Katpadi, Vellore - 632014',
    phone:'+91 416 224 3091', website:'https://vit.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@vit.edu.in', phone:'+91 9876543267' },
    disciplines:[...ENG, 'Robotics & Automation','Mechatronics','Aerospace Engineering','AIDS (AI & Data Science)'],
  },

  // ── HYDERABAD — Engineering ───────────────────────────────────────────────
  {
    name:'Osmania University College of Engineering', slug:'ouce', code:'OUCE',
    type:'ENGINEERING', university:'Osmania University', city:'Hyderabad', state:'Telangana',
    email:'tpo@ouce.ac.in', password:'OUCE@Drive2025',
    address:'University Campus, Hyderabad - 500007',
    phone:'+91 40 2768 2363', website:'https://osmania.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@ouce.ac.in', phone:'+91 9876543268' },
    disciplines:[...ENG],
  },

  // ── KOLKATA — Engineering & Design ───────────────────────────────────────
  {
    name:'Jadavpur University', slug:'jadavpur', code:'JADU',
    type:'ENGINEERING', university:'Jadavpur University (Autonomous)', city:'Kolkata', state:'West Bengal',
    email:'tpo@jadavpur.ac.in', password:'JADU@Drive2025',
    address:'188, Raja S.C. Mallick Road, Kolkata - 700032',
    phone:'+91 33 2414 6666', website:'https://jadavpur.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@jadavpur.ac.in', phone:'+91 9876543269' },
    disciplines:[...ENG, 'Printing Engineering','Food Technology','Pharmaceutical Technology'],
  },
  {
    name:'National Institute of Fashion Technology Kolkata', slug:'nift-kolkata', code:'NIFTKO',
    type:'DESIGN', university:'NIFT (Autonomous)', city:'Kolkata', state:'West Bengal',
    email:'tpo@nift-kolkata.ac.in', password:'NIFTKO@Drive2025',
    address:'Plot No. IIF/7, New Town, Kolkata - 700156',
    phone:'+91 33 6609 5100', website:'https://nift.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@nift-kolkata.ac.in', phone:'+91 9876543270' },
    disciplines:['Fashion Design','Textile & Fashion Design','Leather Design','Fashion Management','Fashion Communication'],
  },

  // ── JAIPUR — Engineering & Design ────────────────────────────────────────
  {
    name:'Malaviya National Institute of Technology', slug:'mnit-jaipur', code:'MNIT',
    type:'ENGINEERING', university:'NIT (Autonomous)', city:'Jaipur', state:'Rajasthan',
    email:'tpo@mnit.ac.in', password:'MNIT@Drive2025',
    address:'JLN Marg, Jaipur - 302017',
    phone:'+91 141 252 9087', website:'https://mnit.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@mnit.ac.in', phone:'+91 9876543271' },
    disciplines:[...ENG, 'Metallurgical & Materials Engineering'],
  },

  // ── COIMBATORE — Engineering ──────────────────────────────────────────────
  {
    name:'PSG College of Technology', slug:'psgct', code:'PSGCT',
    type:'ENGINEERING', university:'Anna University', city:'Coimbatore', state:'Tamil Nadu',
    email:'tpo@psgct.ac.in', password:'PSGCT@Drive2025',
    address:'Peelamedu, Coimbatore - 641004',
    phone:'+91 422 434 3400', website:'https://psgct.ac.in',
    tpo:{ name:'Training & Placement Officer', email:'tpo@psgct.ac.in', phone:'+91 9876543272' },
    disciplines:[...ENG, 'Production Engineering','Robotics & Automation'],
  },
];

// ── Normalise TPO names ────────────────────────────────────────────────────────
// We never hardcode individual TPO names — they change every year.
// The platform will address them as "Respected TPO, <College Name>".
const normalisedColleges = colleges.map(c => ({
  ...c,
  tpo: {
    name:  'Training & Placement Officer',   // generic, always correct
    email: c.tpo?.email || c.email,           // keep the TPO email
    phone: c.tpo?.phone || '',                // keep the TPO phone
  },
}));

async function seedColleges() {
  await connectDB();
  console.log('🌱 Seeding colleges...\n');
  let created = 0, updated = 0;

  for (const data of normalisedColleges) {
    const existing = await College.findOne({ slug: data.slug });
    if (existing) {
      // Always refresh disciplines, type AND tpo to keep it current
      await College.findByIdAndUpdate(existing._id, {
        disciplines: data.disciplines,
        type:        data.type,
        tpo:         data.tpo,
        website:     data.website,
        address:     data.address,
        phone:       data.phone,
      });
      console.log(`  ♻️  Updated: ${data.name}`);
      updated++;
      continue;
    }
    const college = new College(data);
    await college.save();
    console.log(`  ✅ Created: ${data.name} [${data.code}] — ${data.city}`);
    created++;
  }

  console.log(`\n🎓 Done! Created: ${created}, Updated: ${updated}`);
  process.exit(0);
}

seedColleges().catch(err => { console.error(err); process.exit(1); });

