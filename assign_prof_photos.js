const fs=require('fs');
const path=require('path');

const map={
  "meslek-yazilimci": { scene: "Digital_nomad_working_at_beach_202609072308.jpeg", char: "Technician_holding_screwdriver_202609072308.jpeg" },
  "meslek-veri": { scene: "Designer_adjusting_digital_tablet_202609072307.jpeg", char: "Teacher_adjusting_microscope_in_lab_202609072308.jpeg" },
  "meslek-tasarimci": { scene: "Artist_standing_beside_their_scu*.jpeg", char: "Art_teacher_holding_paintbrush_202609072307.jpeg" },
  "meslek-pazarlama": { scene: "Car_salesman_smiling_in_showroom_202609072308.jpeg", char: "Boss_looking_at_camera_202609072307.jpeg" },
  "meslek-ciftci": { scene: "Gardener_pointing_at_sign_202609072307.jpeg", char: "Worker_holding_water_hose_202609072308.jpeg" },
  "meslek-bahcivan": { scene: "Woman_holding_watering_can_202609072307.jpeg", char: "Gardener_pointing_at_sign_202609072307.jpeg" },
  "meslek-balikci": { scene: "Fisherman_holding_fishing_rod_202609072308.jpeg", char: "Fisherman_holding_fishing_rod_202609072308.jpeg" },
  "meslek-itfaiyeci": { scene: "Construction_engineer_at_constru*.jpeg", char: "Firefighter_*.jpeg" },
  "meslek-pilot": { scene: "Technician_inspecting_airplane_p*.jpeg", char: "Bus_driver_looking_in_mirror_202609072307.jpeg" },
  "meslek-ascı": { scene: "Pastry_chef_smiling_in_bakery_202609072307.jpeg", char: "Pastry_chef_smiling_in_bakery_202609072307.jpeg" },
  "meslek-sanatci": { scene: "Artist_standing_beside_their_scu*.jpeg", char: "Art_teacher_holding_paintbrush_202609072307.jpeg" },
  "meslek-muzisyen": { scene: "Music_artist_holding_microphone_202609072307.jpeg", char: "Music_teacher_waiting_by_piano_202609072308.jpeg" },
  "meslek-oyuncu": { scene: "Actor_standing_on_theater_stage_202609072307.jpeg", char: "Director_standing_on_stage_202609072308.jpeg" },
  "meslek-fotografci": { scene: "Photographer_standing_behind_tripod_202609072307.jpeg", char: "Photographer_standing_behind_tripod_202609072307.jpeg" },
  "meslek-gazeteci": { scene: "Author_sitting_at_book_fair_202609072308.jpeg", char: "Teacher_holding_pen_in_classroom_202609072307.jpeg" },
  "meslek-avukat": { scene: "Architecture_professor_pointing_*.jpeg", char: "Boss_looking_at_camera_202609072307.jpeg" },
  "meslek-hakim": { scene: "Assistant_principal_waiting_in_c*.jpeg", char: "Boss_looking_at_camera_202609072307.jpeg" },
};

console.log("map ready", Object.keys(map).length);
