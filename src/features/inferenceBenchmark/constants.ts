/**
 * The throughput benchmark.
 *
 * Its whole purpose is to produce a number that can be compared with the
 * target spec's budget honestly, so every input it depends on is fixed here
 * rather than left to whatever the caller happens to pass.
 */

/** Words per chunk, matching the chunk size the synthesis pipeline targets. */
export const BENCHMARK_CHUNK_WORDS = 220;

/**
 * Chunks per run.
 *
 * Enough that start-up cost is amortised and a stray pause does not dominate,
 * small enough that a run on the software path finishes in well under a minute
 * even if throughput turns out to be poor.
 */
export const BENCHMARK_CHUNK_COUNT = 40;

/**
 * Chunks embedded and discarded before the clock starts.
 *
 * The runtime builds its inference session on first use, so the first batch of
 * any size pays for it. A couple of chunks is enough to absorb that without
 * meaningfully extending the run.
 */
export const WARM_UP_CHUNKS = 2;

/** The budget this measurement is judged against (NFR-004). */
export const MINIMUM_CHUNKS_PER_SECOND = 20;

/**
 * Vocabulary the benchmark text is drawn from.
 *
 * Synthetic rather than scraped: real page text cannot be bundled without
 * either shipping someone's content or fetching at measurement time, and
 * neither belongs in a benchmark that has to be reproducible offline. What
 * matters for tokenizer and encoder cost is the length and the variety of
 * tokens, which sampling a mixed vocabulary reproduces well enough to compare
 * two compute paths against each other.
 *
 * It is not good enough to judge *quality* — nothing here is used for that.
 */
export const BENCHMARK_VOCABULARY: readonly string[] = [
  "battery",
  "capacity",
  "range",
  "motor",
  "torque",
  "frame",
  "aluminium",
  "carbon",
  "warranty",
  "service",
  "interval",
  "charger",
  "voltage",
  "controller",
  "firmware",
  "review",
  "comparison",
  "measured",
  "claimed",
  "manufacturer",
  "retailer",
  "forum",
  "commuting",
  "touring",
  "gravel",
  "hub",
  "derailleur",
  "brake",
  "rotor",
  "pad",
  "suspension",
  "travel",
  "geometry",
  "reach",
  "stack",
  "weight",
  "payload",
  "rack",
  "mudguard",
  "light",
  "lumens",
  "waterproof",
  "rating",
  "ingress",
  "protection",
  "study",
  "evidence",
  "sample",
  "method",
  "result",
  "conclusion",
  "limitation",
  "although",
  "however",
  "therefore",
  "whereas",
  "moreover",
  "nevertheless",
  "approximately",
  "roughly",
  "between",
  "during",
  "without",
  "alongside",
  "despite",
  "kilometre",
  "kilogram",
  "percent",
  "hour",
  "watt",
  "newton",
  "metre",
  "degree",
];

/**
 * A bundled article of about 1,500 words — REQ-NFR-007's "one deep-read page" —
 * that fact extraction is timed on. Written for the purpose, so its facts are
 * known and nothing is fetched; dense with figures, as a comparison page is.
 */
export const EXTRACTION_ARTICLE = [
  "Three commuter e-bikes, tested over a winter of city riding",
  "",
  "We spent four months riding three commuter e-bikes through a northern winter: the Volta E5, the Corsa Urban 2 and the Halden Step. All three are sold as everyday bikes for people who ride to work, carry shopping and park outside. None of them is a racing machine, and none of them is cheap. This review covers how each one rides, what it costs to own, and which kind of rider should choose it.",
  "",
  "How we tested",
  "",
  "Each bike covered at least 900 kilometres on the same mixed route: twelve kilometres of city streets with traffic lights, a four-kilometre climb with an average gradient of five percent, and a stretch of gravel path along the river. We rode in temperatures between minus eight and plus twelve degrees Celsius. We measured range from a full charge to the point where the motor stopped assisting, always in the middle assistance level and with the same rider, who weighs 78 kilograms. We weighed every bike ourselves, without accessories, on a calibrated hanging scale. Prices are the manufacturers' list prices in the United States at the time of testing, before delivery charges.",
  "",
  "The Volta E5",
  "",
  "The Volta E5 is the most expensive bike in this test at 2,399 dollars, and it is also the heaviest at 23.5 kilograms. Most of that weight sits in the frame-integrated battery, which holds 500 watt-hours, and in the mid-drive motor, which produces 85 newton-metres of torque. Volta adds an 80-dollar delivery charge, and the bike arrives almost fully assembled.",
  "",
  "On the road the E5 feels planted. The motor responds smoothly to pedal pressure, and on the four-kilometre climb it was the only bike that let our rider stay seated in the middle assistance level without dropping below fifteen kilometres per hour. The hydraulic disc brakes, with 180-millimetre rotors front and rear, stopped the bike confidently on wet tarmac. The integrated lights are bright enough for unlit paths, and the rear light brightens when you brake.",
  "",
  "Range was the E5's strongest result. In mild weather we covered 96 kilometres on one charge; at minus eight degrees that fell to 71 kilometres, still the best cold-weather figure in the test. A full charge took four hours and forty minutes with the included two-amp charger. A faster four-amp charger is sold separately for 129 dollars.",
  "",
  "There are drawbacks. The weight makes the E5 awkward to carry up stairs, and the battery can only be removed with a key and a hex tool, so riders without a ground-floor place to park and charge should think carefully. The eight-speed hub gear is reliable and needed no adjustment in four months, but its range is narrower than a derailleur's, and strong riders may spin out on long descents. Volta's two-year warranty covers the frame, motor and battery, but the battery warranty ends at 500 charge cycles.",
  "",
  "The Corsa Urban 2",
  "",
  "The Corsa Urban 2 costs 1,749 dollars and weighs 19.8 kilograms, making it the lightest bike here by a clear margin. It uses a rear hub motor rated at 250 watts with 45 newton-metres of torque, and a removable 418 watt-hour battery that slides out of the down tube. Corsa sells a larger 540 watt-hour battery for 499 dollars, but we tested the standard one.",
  "",
  "The Urban 2 is the most fun of the three to ride on flat ground. Its lower weight and quicker steering make it feel like an ordinary bicycle with a tailwind, and the nine-speed derailleur gives it a wide range for both climbs and descents. On the four-kilometre climb, however, the hub motor ran out of breath. Our rider needed the highest assistance level to hold fifteen kilometres per hour, which cut range noticeably on hilly days.",
  "",
  "In mild weather the Urban 2 managed 64 kilometres on one charge. At minus eight degrees it managed 41 kilometres, the largest drop in the test, which we put down to the smaller battery and its position outside the frame's insulation. Charging took three hours and fifty minutes. The mechanical disc brakes worked, but needed adjustment twice during the test as the pads wore, and they were the weakest brakes here in the wet.",
  "",
  "Corsa's strength is practicality for apartment dwellers. The battery comes out without a key and weighs only 2.4 kilograms, so it can be carried inside and charged at a desk. The frame has mounts for a rear rack and fenders, both sold separately: the rack costs 69 dollars and the fender set 49 dollars. Corsa offers a three-year warranty on the frame and two years on electrical parts.",
  "",
  "The Halden Step",
  "",
  "The Halden Step sits between the other two. It costs 2,099 dollars and weighs 21.2 kilograms, with a step-through frame that makes mounting easy for riders of any height and for anyone carrying a child seat. A mid-drive motor with 65 newton-metres of torque pairs with a 540 watt-hour battery mounted on the down tube. Halden includes a rear rack, full fenders and a kickstand in the price, which adds roughly 150 dollars of value compared with the Corsa.",
  "",
  "The Step rides calmly and comfortably. A suspension seat post and 55-millimetre tyres absorb broken tarmac and gravel better than either rival, and the upright position suits short trips in everyday clothes. The motor is less punchy than the Volta's, and on the four-kilometre climb our rider needed the second-highest assistance level to stay above fifteen kilometres per hour, but it never felt strained.",
  "",
  "Range in mild weather was 88 kilometres, and at minus eight degrees 63 kilometres. Charging took five hours and ten minutes, the slowest in the test, because Halden ships a 1.5-amp charger to keep the price down. Hydraulic brakes with 160-millimetre rotors stopped the Step well, although the Volta's larger rotors had more bite on long descents.",
  "",
  "The step-through frame is less stiff than a diamond frame, and with a full load of shopping on the rack the Step flexed slightly in fast corners. Halden's warranty runs for five years on the frame and two years on the motor and battery, with no limit on charge cycles, the most generous terms in this test.",
  "",
  "Living with them in winter",
  "",
  "Cold weather tested more than batteries. Road salt reached every part of each bike within a week, and we rinsed them with fresh water every few days. The Volta's enclosed hub gear and belt guard kept its drivetrain clean, while the Corsa's exposed derailleur collected grit and began to shift poorly after six weeks until we cleaned and oiled it. The Halden's chain needed oil every week and was the one part we replaced. Displays on all three stayed readable at minus eight degrees, but the Corsa's touch buttons did not respond through thick gloves, which made changing the assistance level awkward on cold mornings. Both mid-drive bikes started reliably after nights parked outside; the Corsa twice refused to power on until its battery had warmed indoors for twenty minutes. None of the bikes let water into its electrics during heavy rain.",
  "",
  "Running costs",
  "",
  "All three bikes cost little to run. At an electricity price of 17 cents per kilowatt-hour, a full charge costs about nine cents for the Volta and the Halden and seven cents for the Corsa. Over our test, maintenance was limited to brake pads for the Corsa, which cost 24 dollars a pair, and a chain for the Halden, which cost 32 dollars. The Volta needed nothing. Replacement batteries are the largest long-term expense: 749 dollars for the Volta, 449 dollars for the Corsa's standard battery, and 629 dollars for the Halden.",
  "",
  "Which one to buy",
  "",
  "For long commutes with hills, the Volta E5 is the best bike here. Its motor, brakes and cold-weather range are a class above, and the hub gear asks for almost no maintenance. Its price and weight are the cost of that confidence.",
  "",
  "For riders who live in apartments and ride mostly on flat ground, the Corsa Urban 2 makes the most sense. It is the lightest and cheapest bike in the test, its removable battery is easy to carry, and it is enjoyable to ride. Buyers in cold or hilly places should budget for the larger battery.",
  "",
  "For families, shoppers and anyone who wants a comfortable all-rounder, the Halden Step is the easiest bike to live with. It arrives with everything needed for daily use, rides comfortably on poor surfaces, and has the longest warranty. Its slow charger is the only real annoyance, and a faster one is not yet available.",
  "",
  "Specifications at a glance",
  "",
  "Volta E5: 2,399 dollars, 23.5 kilograms, 500 watt-hour battery, 85 newton-metre mid-drive motor, 96 kilometres of range in mild weather.",
  "Corsa Urban 2: 1,749 dollars, 19.8 kilograms, 418 watt-hour battery, 45 newton-metre rear hub motor, 64 kilometres of range in mild weather.",
  "Halden Step: 2,099 dollars, 21.2 kilograms, 540 watt-hour battery, 65 newton-metre mid-drive motor, 88 kilometres of range in mild weather.",
].join("\n");

/** REQ-NFR-007: fact extraction from one page, with a 3B-to-4B model outside the extension. */
export const MAXIMUM_EXTRACTION_MS = 20_000;

/**
 * What the timed extraction asks for: one comparison-table row per product the
 * article reviews — the shape synthesis fills (REQ-SYN-005), and bounded, so
 * the answer's length does not grow with how much the article says.
 */
export const TABLE_EXTRACTION_INSTRUCTIONS =
  "From the article, extract one row for each e-bike it reviews: its name, its list price in US dollars, its weight in kilograms, its battery capacity in watt-hours, its motor torque in newton-metres, and its range in mild weather in kilometres. Give numbers without units. Answer with JSON only.";

/** The JSON schema the timed extraction is constrained to; mirrors `extractedTableSchema`. */
export const EXTRACTED_TABLE_JSON_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          priceUsd: { type: "number" },
          weightKg: { type: "number" },
          batteryWh: { type: "number" },
          torqueNm: { type: "number" },
          rangeKm: { type: "number" },
        },
        required: ["name", "priceUsd", "weightKg", "batteryWh", "torqueNm", "rangeKm"],
      },
    },
  },
  required: ["products"],
} as const;

/** What the article says about each product, so an answer can be checked as well as timed. */
export const EXTRACTION_ARTICLE_TABLE = [
  { name: "Volta E5", priceUsd: 2399, weightKg: 23.5, batteryWh: 500, torqueNm: 85, rangeKm: 96 },
  {
    name: "Corsa Urban 2",
    priceUsd: 1749,
    weightKg: 19.8,
    batteryWh: 418,
    torqueNm: 45,
    rangeKm: 64,
  },
  {
    name: "Halden Step",
    priceUsd: 2099,
    weightKg: 21.2,
    batteryWh: 540,
    torqueNm: 65,
    rangeKm: 88,
  },
] as const;

/** Room for three rows; a run that needs more has gone wrong. */
export const TABLE_EXTRACTION_MAX_TOKENS = 512;

/**
 * How often a running extraction reports progress. Well under Firefox's 30 s
 * idle timeout for an event page: the reports are also what keeps the
 * background alive while it waits on a long answer.
 */
export const EXTRACTION_PROGRESS_INTERVAL_MS = 1_000;
