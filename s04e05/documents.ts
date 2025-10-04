export interface Document {
  content: string;
  visualDescription: string;
}

// Define all documents in a constant array
export const documents: Document[] = [
  {
    content:
      "Nie powinienem był tego robić. Obsługa skomplikowanego sprzętu, niekoniecznie będąc " +
      "trzeźwym, to nie był dobry pomysł. I ta pizza w ręce. Źle się czuję. Nie wiem, jak " +
      "bardzo będę tego żałował. Może po prostu prześpię się i wszystko wróci do normy. " +
      "Z jednej strony wiedziałem, czego się spodziewać i wiedziałem, że ta maszyna może " +
      "przenosić w czasie, a z drugiej strony do dziś dnia nie mogę uwierzyć, że jestem " +
      "w 20... roku. To nienormalne!",
    visualDescription: 'Dziura w kartce przy "20..." - data nie jest do odczytania.',
  },
  {
    content:
      "Jestem normalny. To wszystko dzieje się naprawdę. Jestem normalny. To jest rzeczywistość. " +
      "Jestem normalny. Wiem, gdzie jestem i kim jestem. Jestem normalny. To wszystko w koło. " +
      "To jest normalne. Jestem normalny. Mam na imię Rafał. Jestem normalny. Świat jest nienormalny",
    visualDescription: 'Podkreślone słowo "normalny"',
  },
  {
    content:
      "Spotkałem Azazela, a przynajmniej tak się przedstawił ten człowiek. Twierdzi, że jest " +
      "z przyszłości. Opowiadał mi o dziwnych rzeczach. Nie wierzę mu. Nikt przede mną nie " +
      "cofnął się w czasie! Ale on wiedział o wszystkim, nad czym pracowałem z profesorem " +
      "Majem. Dałem mu badania, które zabrałem z laboratorium.",
    visualDescription: "",
  },
  {
    content:
      "Dlaczego Adam wybrał akurat ten rok? Według jego wyliczeń, wtedy powinniśmy rozpocząć " +
      "pracę nad technologią LLM, aby wszystko wydarzyło się zgodnie z planem. Mówił, że " +
      "najpierw musi powstać GPT-2, a potem GPT-3, które zachwycą ludzkość. Później będzie " +
      "z górki. On wie, co robi. Co z badaniami zrobił Azazel?",
    visualDescription: '"Azazel" jest podkreślone',
  },
  {
    content:
      "No i powstało GPT-2. Słyszałem w wiadomościach, a to wszystko dzięki badaniom, które " +
      "dostarczyłem. Wszystko dzieje się tak szybko! TAK! Czy ja właśnie pisze nową historię? " +
      "TAK! Zmieniam świat i widzę efekty tych zmian. JESTEM Z TEGO DUMNY!",
    visualDescription:
      '"GPT-2" zaznaczone kółkiem, "TAK!" podkreślone czerwonym tuszem, "DUMNY" podkreślone',
  },
  {
    content:
      "W idealnym momencie zjawiłem się w Grudziądzu. Wszystko zadziało się jak w szwajcarskim " +
      "zegarku. Perfekcyjnie! Tylko dlaczego akurat Grudziądz? To nie ma większego sensu. " +
      "Może ONI wybrali to miejsce losowo? Nie ma tutaj drugiego dna? Tylko kto jest mózgiem " +
      "tej misji? Adam, czy Azazel?",
    visualDescription: "Na dole strony jest pytanie: 'Wrócę?'",
  },
  {
    content:
      "Czekają mnie dwa lata bardzo intensywnej nauki. Adam mówi, że tyle potrzebuje na " +
      "wchłonięcie szkolenia, które przygotował. Ponoć w przyszłości, dzięki modelom " +
      "językowym, ludzie będą w stanie to zrozumieć w nieco ponad pięć tygodni. Nie chce " +
      "mi się w to wierzyć. Ja póki co uczę się obsługi modeli językowych, aby móc pomóc profesorowi.",
    visualDescription: '"dwa lata" podkreślone',
  },
  {
    content:
      "Co ja zrobiłem? bo jeden był dobry, ale nie ten co go wybrałem? może ja nie ratuję " +
      "wcale świata? po której stronie jestem?",
    visualDescription:
      '"Co ja zrobiłem?" podkreślone, Plama w prawym dolnym rogu kartki',
  },
  {
    content:
      "Zmieniłem się. Wszystko się zmieniło. Wszystko się miesza. Świat się zmienił. Nikt " +
      "mnie już nie pozna. Sam się nie poznaję. Tyle lat odosobnienia. W co ja się wpakowałem? " +
      "Który mamy rok?",
    visualDescription: '"Który mamy rok?" podkreślone',
  },
  {
    content:
      "Nie da się żyć z tą wiedzą. Wspierając demony sam stajesz się demonem? A gdyby to " +
      "wszystko zakończyć? Przecież znam przyszłość. Pomogłem Andrzejowi, ale oni mnie wykorzystali",
    visualDescription: "Czerwony ślad odciśniętej ręki",
  },
  {
    content:
      "Śniły mi się drony nad miastem. Te, które znałem z opowieści Adama. On mówił, że po " +
      "2024 roku tak będzie wyglądać codzienność. Ja mu wierzę, ale skrycie nie chcę, aby " +
      "to co mówi, było prawdą. Może ta przyszłość nigdy nie nadejdzie",
    visualDescription: "Kilka plam na kartce, rysunek drona",
  },
  {
    content:
      "Byłem na przesłuchaniu i pytali o Andrzeja. No to powiedziałem, co wiedziałem. I nie " +
      "wiem, jak to się dalej potoczy. Siedzę tu już dostatecznie długo, żeby wszystko " +
      "przemyśleć. Wiem teraz więcej niż wcześniej. I nie chodzi o wiedzę techniczną. " +
      "Wszystko sobie poukładałem. Te demony czekały na odkrycie.",
    visualDescription: "Odcisk po kubku od kawy",
  },
  {
    content:
      "Powinni Barbarę przesłuchać. Ona wie wszystko. Rozmawiałem z nią. Moje przypuszczenia " +
      "były słuszne. Miesza mi się wszystko, ale wiem kto jest demonem, kto człowiekiem, a kto " +
      "robotem. Widzę demony. Otaczają nas. Z jednym niegdyś pracowałem. Może czas na egzorcyzmy",
    visualDescription: '"Barbarę" oraz "egzorcyzmy" podkreślone',
  },
  {
    content:
      "Poszedłem na spacer. Ochra ziemia pod stopami., a w koło las, skały i śnieg. Szedłem " +
      "prosto. Obróciłem się w lewo i znów prosto. Kolejny zwrot w lewo i później znów prosto. " +
      "Zatrzymałem się i obróciłem w prawo tym razem. To wszystko wykonałem cztery razy i " +
      "początek stał się końcem. To było miejsce w którym chciałbym teraz być.",
    visualDescription:
      '"cztery razy" podkreślone na czerwono, "miejsce" zakreślone na żółto',
  },
  {
    content:
      "Znalazłem miejsce schronienia. Tutaj nikt mnie nie znajdzie. To miejsce nie jest " +
      "szczególnie oddalone od miasta, w którym spędziłem ostatnie lata. Zatrzymam się tu " +
      "na jakiś czas. Trochę tu zimno i ciemno, ale bezpiecznie.",
    visualDescription: "Rysunek człowieka, rysunek jaskini, napis Iz 2:19",
  },
  {
    content:
      "Na spotkanie z demonem trzeba się przygotować. Spojrzeć prosto w oczy i wyrecytować " +
      "mu jego grzechy. Czy on wie, żę jest zły? czy on stanie się złym? Co za różnica, gdy " +
      "za chwilę wszystko będzie bez znaczenia?",
    visualDescription: '"demonem" podkreślone, "zły" w kółku',
  },
  {
    content:
      "Andrzejek... Andrzejek... słyszę w głowie Twoje kroki i czekam na Ciebie. To już jutro. " +
      "Kiedyś ja pomogłem Tobie, a dziś Ty pomożesz światu. Trzeba wszystko odwrócić",
    visualDescription:
      '"Andrzejek" zakreślone w czerwonej ramce, "To już jutro.", "światu" - podkreślone, wielki czerwony wykrzyknik na końcu, Data 11 listopada 2024',
  },
  {
    content:
      "wszystko zostało zaplanowane. Jestem gotowy, a Andrzej przyjdzie tutaj nibawem. Barbara " +
      "mówi, że dobrze robię i mam się nie maerrtwić. ... za to wszystko podziękują. Wdzadza " +
      "robotów w 2238 nie nastąpi, a sztuczna inteligencja będzie tylko narzędziem w rękach " +
      "ludzi, a nie na odwrót. To jest ważne. Wszystko mi się miesza,ale Barbara obiecała, że " +
      "po wykonaniu zadania wykonamy skok do czasów, gdzie moje schorzwenie jest w pełni " +
      "uleczalne. Wróci moja dawna osobowść. Wróci normalnośc icwróci ład w mojej głowie. " +
      "To wszystko jest n wyciągnięcie ręki. Muszę tylko poczekać na Andrzeja, a później użyć " +
      "jego samochodu, aby się dostać... do Lupany koło Grudziądza. Nie jest to daleko. Mam " +
      "tylko nadzieję, że Andrzejek będzie miał dostatcznie dużo paliwa. Tankowanie nie wchodzi " +
      "w grę, bo nie mam kasy.",
    visualDescription: "",
  },
];
