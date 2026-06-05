import { Component, Input, OnInit } from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { RdvService } from "src/app/services/rdv/rdv.service";
import { SharedDataService } from "src/app/services/shared/shared.service";

@Component({
  selector: "app-manage-public-holidays",
  templateUrl: "./manage-public-holidays.component.html",
  styleUrls: ["./manage-public-holidays.component.css"],
})
export class ManagePublicHolidaysComponent implements OnInit {
  @Input() existingHolidays: any[] = []; // Format: ['01-01', '03-20', ...]
  @Input() year: number = new Date().getFullYear();
  fixedHolidays = [
    { date: "01-01", name: "Nouvel An" },
    { date: "03-20", name: "Fête de l'Indépendance" },
    { date: "04-09", name: "Jour des Martyrs" },
    { date: "05-01", name: "Fête du Travail" },
    { date: "07-25", name: "Fête de la République" },
    { date: "08-13", name: "Fête de la Femme" },
    { date: "10-15", name: "Fête de l'Évacuation" },
    { date: "12-17", name: "Fête de la Révolution" },
  ];
  variableHolidays = [
    {
      name: "Aïd el-Fitr (Petit Aïd)",
      description: "Fête de rupture du jeûne - 1 jour",
      selectedDate: this.getDefaultAidDate(1), // Date par défaut
      checked: false,
      type: "religious",
    },
    {
      name: "Aïd el-Fitr (2ème jour)",
      description: "Deuxième jour du Petit Aïd",
      selectedDate: this.getDefaultAidDate(2),
      checked: false,
      type: "religious",
    },
    {
      name: "Aïd el-Adha (Grand Aïd)",
      description: "Fête du sacrifice - 1 jour",
      selectedDate: this.getDefaultAidDate(3),
      checked: false,
      type: "religious",
    },
    {
      name: "Aïd el-Adha (2ème jour)",
      description: "Deuxième jour du Grand Aïd",
      selectedDate: this.getDefaultAidDate(4),
      checked: false,
      type: "religious",
    },
    {
      name: "Ras el-Am Hejri",
      description: "Nouvel an islamique",
      selectedDate: this.getDefaultAidDate(5),
      checked: false,
      type: "religious",
    },
    {
      name: "Mouled",
      description: "Anniversaire du Prophète",
      selectedDate: this.getDefaultAidDate(6),
      checked: false,
      type: "religious",
    },
  ];

  selectedHolidays: { date: string; name: string; type: string }[] = [
    ...this.fixedHolidays.map((h) => ({ ...h, type: "fixed" })),
  ];
  publicHolidaysDaysInDb: any;

  constructor(public modal: NgbActiveModal, private rdvService: RdvService,private sharedService :SharedDataService) {}

  ngOnInit(): void {
    this.rdvService.getListHolidaysDays().subscribe((data) => {
      this.publicHolidaysDaysInDb = data.publicHolidays;

      // Initialiser selectedHolidays avec tous les jours de la DB (fixes + variables)
      this.selectedHolidays = [];

      this.publicHolidaysDaysInDb.forEach((dbHoliday) => {
        // Vérifier si c'est une fête fixe
        const fixedHoliday = this.fixedHolidays.find(
          (h) => h.date === dbHoliday.date
        );
        if (fixedHoliday) {
          this.selectedHolidays.push({ ...fixedHoliday, type: "fixed" });
        } else {
          // Sinon, c'est une fête variable
          this.selectedHolidays.push({
            date: dbHoliday.date,
            name: dbHoliday.name,
            type: "variable",
          });
        }
      });

      // ÉTAPE IMPORTANTE : Initialiser variableHolidays
      this.initializeVariableHolidaysFromDb();
    });
  }
  initializeVariableHolidaysFromDb(): void {
    this.variableHolidays.forEach((variableHoliday) => {
      // Chercher si cette fête existe dans la DB
      const existingHoliday = this.selectedHolidays.find(
        (sh) => sh.name === variableHoliday.name && sh.type === "variable"
      );

      if (existingHoliday) {
        // Convertir "MM-DD" en "YYYY-MM-DD" pour l'input date
        const currentYear = new Date().getFullYear();
        variableHoliday.selectedDate = `${currentYear}-${existingHoliday.date}`;
        variableHoliday.checked = true;
      }
    });

  }
  // Obtenir une date par défaut (exemple)
  getDefaultAidDate(type: number): string {
    const currentYear = new Date().getFullYear();
    
    // Dates de référence pour 2024 (année de base)
    const baseYear = 2024;
    const baseDates = [
        { month: 5, day: 2 },   // Aïd el-Fitr 2024
        { month: 5, day: 3 },   
        { month: 7, day: 9 },   // Aïd el-Adha 2024
        { month: 7, day: 10 },  
        { month: 7, day: 30 },  // Ras el-Am 2024
        { month: 9, day: 27 },  // Mouled 2024
    ];
    
    const baseDate = baseDates[type - 1];
    if (!baseDate) return `${currentYear}-01-01`;
    
    // Calcul du décalage (11 jours par année environ)
    const yearsDiff = currentYear - baseYear;
    const daysShift = yearsDiff * 11;
    
    // Créer une date et soustraire le décalage
    const date = new Date(currentYear, baseDate.month - 1, baseDate.day);
    date.setDate(date.getDate() - daysShift);
    
    // Formater le résultat
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${currentYear}-${month}-${day}`;
}
  getHolidayIcon(holidayName: string): string {
    if (holidayName.includes("Aïd")) return "fa-star";
    if (holidayName.includes("Ras")) return "fa-moon";
    if (holidayName.includes("Mouled")) return "fa-mosque";
    return "fa-calendar";
  }

  isHolidayInDb(date: string): boolean {
    if (!this.publicHolidaysDaysInDb) {
      return false;
    }

    // Normaliser la date au format "MM-DD"
    let dateToCheck: string;

    if (date.includes("-") && date.length === 10) {
      // Format "YYYY-MM-DD" → extraire "MM-DD"
      const [, month, day] = date.split("-");
      dateToCheck = `${month}-${day}`;
    } else {
      // Format "MM-DD" ou autre → utiliser tel quel
      dateToCheck = date;
    }

    const exists = this.publicHolidaysDaysInDb.some((dbHoliday) => {
      return dbHoliday.date === dateToCheck;
    });

    return exists;
  }

  // Gérer les fêtes fixes
  isHolidaySelected(date: string): boolean {
    return this.existingHolidays.some((holiday) => holiday.date === date);
  }
  // Obtenir le nom du mois
  getMonthName(dateString: string): string {
    const [month] = dateString.split("-");
    const months = [
      "JAN",
      "FÉV",
      "MAR",
      "AVR",
      "MAI",
      "JUN",
      "JUL",
      "AOÛ",
      "SEP",
      "OCT",
      "NOV",
      "DÉC",
    ];
    return months[parseInt(month, 10) - 1];
  }

  // Obtenir le jour
  getDay(dateString: string): string {
    const [, day] = dateString.split("-");
    const dayNum = parseInt(day, 10);
    return dayNum === 1 ? "1er" : dayNum.toString();
  }

  // Obtenir la date complète
  getFullDate(dateString: string): string {
    const [month, day] = dateString.split("-");
    const months = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];
    const dayNum = parseInt(day, 10);
    return dayNum === 1
      ? `1er ${months[parseInt(month, 10) - 1]}`
      : `${dayNum} ${months[parseInt(month, 10) - 1]}`;
  }

  // Vérifier si un jour férié est sélectionné
  // isHolidaySelected(date: string): boolean {
  //   return this.selectedHolidays.some(holiday => holiday.date === date);
  // }

  // Basculer la sélection d'un jour férié
  toggleHoliday(date: string, event: any): void {
    if (event.target.checked) {
      const holidayToAdd = this.fixedHolidays.find((h) => h.date === date);
      if (holidayToAdd && !this.selectedHolidays.some((h) => h.date === date)) {
        this.selectedHolidays.push({ ...holidayToAdd, type: "fixed" });
      }
    } else {
      this.selectedHolidays = this.selectedHolidays.filter(
        (h) => !(h.date === date && h.type === "fixed")
      );
    }

  }

  saveHolidays(): void {
    this.rdvService.holidaysDaysUpdate(this.selectedHolidays).subscribe({
      next: (response) => {
          this.sharedService.emitSubmitEvent();
        this.modal.close(this.selectedHolidays);
      },
      error: (error) => {
        console.error("Erreur lors de la sauvegarde:", error);
      },
    });
  }

  toggleVariableHoliday(holiday: any, event: any): void {

    const dateObj = new Date(holiday.selectedDate);
    const formattedDate = `${(dateObj.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${dateObj.getDate().toString().padStart(2, "0")}`;

    if (event.target.checked) {
      if (
        !this.selectedHolidays.some(
          (h) => h.name === holiday.name && h.type === "religious"
        )
      ) {
        this.selectedHolidays.push({
          date: formattedDate,
          name: holiday.name,
          type: "religious",
        });
      }
    } else {
      this.selectedHolidays = this.selectedHolidays.filter(
        (h) => h.name !== holiday.name
      );
    }

  }

  onVariableHolidayDateChange(holiday: any, event: any): void {
    

    // 1. Mettre à jour la date dans variableHolidays
    holiday.selectedDate = event.target.value;

    // 2. Si la fête est cochée, mettre à jour selectedHolidays
    if (holiday.checked) {
      // Convertir la nouvelle date en format "MM-DD"
      const dateObj = new Date(holiday.selectedDate);
      const formattedDate = `${(dateObj.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${dateObj.getDate().toString().padStart(2, "0")}`;

      // Mettre à jour selectedHolidays
      const existingIndex = this.selectedHolidays.findIndex(
        (h) => h.name === holiday.name && h.type === "variable"
      );

      if (existingIndex !== -1) {
        // Mettre à jour la date existante
        this.selectedHolidays[existingIndex].date = formattedDate;
      } else {
        // Ajouter nouvelle entrée
        this.selectedHolidays.push({
          date: formattedDate,
          name: holiday.name,
          type: "variable",
        });
      }
    }

  }

  // Méthodes pour le résumé
  getTotalSelectedHolidays(): number {
    return this.selectedHolidays.length;
  }

  getSelectedFixedHolidays(): number {
    return this.selectedHolidays.filter((h) => h.type === "fixed").length;
  }

  getSelectedVariableHolidays(): number {
    return this.selectedHolidays.filter((h) => h.type === "variable").length;
  }
}
