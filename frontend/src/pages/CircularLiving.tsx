import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, RefreshCw, Heart, Recycle, Trash2, Package, Search, ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { createAction } from '@/services/api';
import styles from './CircularLiving.module.css';

const circularOptions = [
  { key: 'maintain', label: 'Maintain', icon: Package, color: 'green', description: 'Keep using it in its current state with regular care.', priority: 1 },
  { key: 'repair', label: 'Repair', icon: Wrench, color: 'green', description: 'Fix a defect to restore its original function.', priority: 2 },
  { key: 'reuse', label: 'Reuse', icon: RefreshCw, color: 'lime', description: 'Use it again for the same or a different purpose.', priority: 3 },
  { key: 'donate', label: 'Donate', icon: Heart, color: 'lime', description: 'Give it to someone who can use it.', priority: 4 },
  { key: 'recycle', label: 'Recycle', icon: Recycle, color: 'amber', description: 'Process the material into something new.', priority: 5 },
  { key: 'dispose', label: 'Dispose', icon: Trash2, color: 'gray', description: 'Last resort — responsible safe disposal.', priority: 6 },
] as const;

type CircularKey = 'maintain' | 'repair' | 'reuse' | 'donate' | 'recycle' | 'dispose';

interface OptionGuidance {
  applicable: boolean;
  guidance: string;
  locationSpecific: boolean;
}

const itemGuidance: Record<string, Partial<Record<CircularKey, { applicable: boolean; guidance: string; locationSpecific: boolean }>>> = {
  smartphone: {
    maintain: { applicable: true, guidance: 'Clean regularly, use a protective case, keep software updated and avoid extreme temperatures.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Ask a local repair professional about battery, screen, or charging-port repair. Parts availability and repairability vary by model.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'An older smartphone can serve as a media player, security camera, smart home hub, or emergency backup device.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Ask a local school or registered community organisation whether it accepts functional smartphones. Erase personal data before handing it over.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Use an authorised e-waste collection or recycling channel in India. Do not place a phone in household waste.', locationSpecific: true },
    dispose: { applicable: false, guidance: 'Smartphones should never go in general waste — they contain hazardous materials and valuable recoverable metals.', locationSpecific: false },
  },
  'winter coat': {
    maintain: { applicable: true, guidance: 'Clean according to label instructions. Store clean and dry to prevent mould and moth damage. Repair minor wear promptly.', locationSpecific: false },
    repair: { applicable: true, guidance: 'A local tailor can assess whether zips, buttons, or torn seams can be repaired. Costs vary; obtain a quote before deciding.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'A coat in good condition can be passed to a family member or friend, used for camping/outdoor work, or upcycled.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Ask a local community organisation whether it accepts clean clothing in wearable condition.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Check whether your local body or an authorised waste service accepts textiles. Mixed-fibre recovery varies.', locationSpecific: true },
    dispose: { applicable: false, guidance: 'Avoid landfill where possible — use textile recycling even for worn items.', locationSpecific: false },
  },
  'glass jar': {
    maintain: { applicable: true, guidance: 'Glass jars are extremely durable. Clean thoroughly and reuse indefinitely.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Broken glass cannot be practically repaired for safe food use.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Glass jars are excellent for food storage, drinking glasses, plant pots, pencil holders, candle holders, or fermentation jars.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Ask local community groups or refill shops whether they can reuse clean jars.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Check whether your local body accepts glass separately. Rinse the jar and follow local sorting instructions for lids and glass.', locationSpecific: true },
    dispose: { applicable: false, guidance: 'Glass should be recycled, not placed in general waste.', locationSpecific: false },
  },
  'wooden chair': {
    maintain: { applicable: true, guidance: 'Tighten loose joints regularly. Sand and re-varnish as needed. Keep away from excessive moisture.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Loose joints can be re-glued. Broken legs or rails can often be replaced or spliced. Upholstery can be replaced by a professional or DIY.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'A sturdy wooden chair can be refinished, repainted, or reupholstered to give it a new look and purpose.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Charity shops, community centres, and furniture reuse organisations often accept good-quality chairs. Confirm condition requirements before donating.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Untreated wood can sometimes go to wood recycling or composting. Treated, painted, or upholstered furniture may be accepted at household waste recycling centres.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'Bulky waste collection or household waste recycling centre. Check local authority schedules and requirements.', locationSpecific: true },
  },
  'plastic container': {
    maintain: { applicable: true, guidance: 'Inspect for cracks before each use. Do not use cracked plastic containers for food — they can harbour bacteria.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Cracked plastic containers are generally not safely repairable for food use.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Intact plastic containers can be reused for storage, seedling pots, craft organisation, or non-food storage.', locationSpecific: false },
    donate: { applicable: false, guidance: 'Charity shops generally do not accept used plastic food containers.', locationSpecific: false },
    recycle: { applicable: true, guidance: 'Check the resin identification mark and ask your local body or authorised waste service whether that plastic is accepted. Rinse and sort as locally instructed.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'If the item cannot be reused or accepted by a local collection service, follow your local body’s household-waste instructions.', locationSpecific: true },
  },
  laptop: {
    maintain: { applicable: true, guidance: 'Keep vents clear, avoid liquids and heat, and follow the manufacturer’s battery and care instructions.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Ask a qualified repairer about the battery, screen, keyboard, or storage. Do not open a swollen or damaged battery.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'If safe and supported, repurpose the laptop for a secondary task or pass it to someone who can use it. Securely erase personal data first.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Confirm the recipient accepts working computers and securely erase the storage before transfer.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Use an authorised e-waste take-back or collection channel. Keep the laptop and battery out of household waste.', locationSpecific: true },
    dispose: { applicable: false, guidance: 'Do not place a laptop or its battery in general waste; verify an authorised e-waste route.', locationSpecific: true },
  },
  charger: {
    maintain: { applicable: true, guidance: 'Unplug by holding the connector, keep the cable dry, and stop using it if the casing, plug, or cable is damaged.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Do not splice or open a mains charger. Replace a damaged charger with a compatible, safety-certified product.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Keep or pass on only if the charger is undamaged and its connector and electrical rating match the device.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Offer only a working, undamaged charger with its connector and rating clearly identified.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Treat unwanted chargers as e-waste and check for an authorised local collection route.', locationSpecific: true },
    dispose: { applicable: false, guidance: 'Do not put chargers in mixed waste where an authorised e-waste collection route is available.', locationSpecific: true },
  },
  battery: {
    maintain: { applicable: true, guidance: 'Store batteries as instructed by the manufacturer. Keep terminals away from metal objects and do not use swollen, leaking, or damaged batteries.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Never puncture, open, recharge a non-rechargeable battery, or attempt to repair a damaged battery.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Reuse only rechargeable batteries that are undamaged and approved for the device. Do not mix battery types or ages.', locationSpecific: false },
    donate: { applicable: false, guidance: 'Do not donate damaged or leaking batteries. Check local rules for safe hand-off of usable batteries.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Keep batteries separate from household waste and use an authorised battery collection or take-back channel.', locationSpecific: true },
    dispose: { applicable: false, guidance: 'Do not burn, puncture, or put batteries in general waste; follow local hazardous-waste instructions.', locationSpecific: true },
  },
  clothing: {
    maintain: { applicable: true, guidance: 'Follow the garment care label, wash only when needed, and store clean and dry.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Mend a loose seam, button, or zip if safe and practical; ask for a quote for specialist repairs.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Wear again, pass to someone who needs it, or repurpose clean fabric where suitable.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Donate only clean, wearable clothing and check the recipient’s accepted items first.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Check whether a local textile collection accepts this fabric; mixed-fibre recovery is not available everywhere.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'If unusable and no textile collection accepts it, follow local residual-waste instructions.', locationSpecific: true },
  },
  shoes: {
    maintain: { applicable: true, guidance: 'Clean according to the material care guidance and let shoes dry fully before storage.', locationSpecific: false },
    repair: { applicable: true, guidance: 'A cobbler may be able to replace soles, heels, or stitching; compare a real quote with replacement cost.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Continue using safe, comfortable shoes or pass wearable pairs to someone who needs them.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Donate only clean pairs in wearable condition and confirm the organisation accepts footwear.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Check for an accepted footwear take-back or textile collection; mixed-material shoes are not accepted everywhere.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'If unsafe or unusable and no collection accepts them, follow local residual-waste instructions.', locationSpecific: true },
  },
  paper: {
    maintain: { applicable: true, guidance: 'Keep clean paper dry and reuse blank sides for notes where practical.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Paper is generally not repaired; reuse clean sheets before recycling.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Reuse clean paper or packaging for notes, packing, or storage where suitable.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Offer usable books or large quantities of clean paper only to a recipient that has asked for them.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Keep paper clean and dry and check whether your local collection accepts it. Remove non-paper materials if instructed.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'If contaminated or not accepted for recycling, follow local waste instructions; do not burn it.', locationSpecific: true },
  },
  food: {
    maintain: { applicable: true, guidance: 'Store food safely according to its label and use older suitable items first. Discard food that is unsafe to eat.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Food cannot be repaired; prevent avoidable waste through safe storage and meal planning.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Use safe leftovers promptly in another meal, following food-safety guidance and storage limits.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Share only suitable, safely handled food through a recipient or programme that accepts it; never donate unsafe food.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Separate unavoidable food scraps for composting only if you have a suitable, accepted local route.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'Follow local instructions for unavoidable food scraps and keep them separate where required.', locationSpecific: true },
  },
  bicycle: {
    maintain: { applicable: true, guidance: 'Check tyre pressure, brakes, chain, and lights regularly; follow the manufacturer’s safety instructions.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Have safety-critical brakes, steering, wheels, or frame damage assessed by a qualified bicycle mechanic.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Continue riding if it is safe, or adapt it for a suitable new use without compromising safety.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Donate a safe, usable bicycle only to a recipient that accepts it; disclose faults clearly.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Ask a bicycle shop or local scrap service about separating recoverable metal and other components.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'Use a local bulky-waste or authorised scrap route if it cannot be safely repaired or reused.', locationSpecific: true },
  },
  appliance: {
    maintain: { applicable: true, guidance: 'Follow the manual for cleaning and maintenance; unplug before user-serviceable cleaning and keep ventilation clear.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Use a qualified technician for electrical or gas repairs. Compare an actual quote with replacement and safety requirements.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Keep using a safe, functional appliance or pass it on with its condition and known faults disclosed.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Confirm the recipient accepts this appliance and that it is safe and functional. Remove personal data from connected devices.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Check for an authorised e-waste or appliance take-back route; remove batteries only if the manual says it is safe.', locationSpecific: true },
    dispose: { applicable: false, guidance: 'Do not put electrical appliances in mixed waste where an authorised collection route is available.', locationSpecific: true },
  },
  'cooking oil': {
    maintain: { applicable: true, guidance: 'Store oil in a sealed container away from heat and light; follow food-safety guidance on whether it remains usable.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Used cooking oil cannot be repaired or made safe by mixing it with fresh oil.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Reuse only if it remains suitable for food use and has been handled safely; do not reuse oil that is degraded or contaminated.', locationSpecific: false },
    donate: { applicable: false, guidance: 'Do not donate used cooking oil for food use.', locationSpecific: false },
    recycle: { applicable: true, guidance: 'Collect cooled oil in a sealed container and check whether an authorised local collection accepts it.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'Never pour oil into a sink, drain, or stormwater system. Follow local instructions if no collection exists.', locationSpecific: true },
  },
  'paint or chemical': {
    maintain: { applicable: true, guidance: 'Keep the original label and container closed, upright, and stored as directed, away from children and heat.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Do not mix unknown chemicals or attempt to repair a leaking container; follow the product safety label.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Use only for the labelled purpose and within the product’s safe-use instructions. Do not mix leftovers.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Transfer only if local rules and the recipient permit it and the original label is intact. Never hand over an unknown chemical.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Check with your local authority for household hazardous-waste collection. Do not put liquid paint or chemicals in recycling.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'Follow the safety label and local hazardous-waste instructions. Do not pour into drains, soil, or ordinary waste.', locationSpecific: true },
  },
  'metal can': {
    maintain: { applicable: true, guidance: 'Keep the can clean and dry if you plan to reuse it; check for sharp edges and corrosion.', locationSpecific: false },
    repair: { applicable: false, guidance: 'Do not try to repair a sharp-edged or structurally damaged can for food or drink use.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Reuse only if it is clean, stable, and has no sharp edges. Avoid food use if its coating or prior contents are unknown.', locationSpecific: false },
    donate: { applicable: false, guidance: 'Used packaging cans are not generally suitable for donation; offer them only if a recipient specifically requests them.', locationSpecific: false },
    recycle: { applicable: true, guidance: 'Check whether your local collection accepts metal packaging. Empty and rinse it if local instructions request this.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'If not accepted for recycling, follow local waste instructions and contain sharp edges safely.', locationSpecific: true },
  },
  furniture: {
    maintain: { applicable: true, guidance: 'Keep furniture dry, tighten loose fittings, and follow material-specific care instructions.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Check whether loose joints, damaged upholstery, or hardware can be repaired. Get a quote for structural damage.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Continue using it or adapt it only if it remains stable and safe for its intended use.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Offer clean, safe furniture and confirm the recipient can accept its size and condition.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Ask your local authority or an authorised service about bulky furniture and material separation.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'Use an arranged bulky-waste collection or authorised service; do not leave furniture in public space.', locationSpecific: true },
  },
  toy: {
    maintain: { applicable: true, guidance: 'Check regularly for loose, broken, or sharp parts and follow the product’s age and care instructions.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Repair only if the toy can be made safe for its intended age group; do not leave small or sharp loose parts.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Keep using a clean, complete toy that remains safe and appropriate for the child.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Donate only clean, safe toys with required parts and confirm the recipient accepts them.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Check local acceptance; toys made of mixed plastic, fabric, batteries, or electronics may need separate routes.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'Separate batteries or electronic components where safe and follow local disposal instructions for the remaining parts.', locationSpecific: true },
  },
  mattress: {
    maintain: { applicable: true, guidance: 'Use the care instructions, keep the mattress dry, and rotate it only if the manufacturer recommends it.', locationSpecific: false },
    repair: { applicable: true, guidance: 'Check the warranty and ask the manufacturer or a qualified service provider whether a repair is possible and hygienic.', locationSpecific: false },
    reuse: { applicable: true, guidance: 'Reuse only if it is clean, dry, and in safe, usable condition.', locationSpecific: false },
    donate: { applicable: true, guidance: 'Ask a recipient first; many organisations cannot accept used mattresses for hygiene or handling reasons.', locationSpecific: true },
    recycle: { applicable: true, guidance: 'Check for a local bulky-item service that accepts mattresses; material recovery availability varies.', locationSpecific: true },
    dispose: { applicable: true, guidance: 'Arrange disposal through your local authority or an authorised bulky-waste service.', locationSpecific: true },
  },
};

const generalGuidance: Record<CircularKey, OptionGuidance> = {
  maintain: {
    applicable: true,
    guidance: 'Follow the manufacturer’s care instructions and keep the item in good condition. Stop using it if it becomes unsafe or damaged.',
    locationSpecific: false,
  },
  repair: {
    applicable: true,
    guidance: 'Consider repair only if the item can be made safe. Use a qualified professional for electrical, structural, pressurised, chemical, or battery components.',
    locationSpecific: false,
  },
  reuse: {
    applicable: true,
    guidance: 'Reuse the item only for a purpose it is suitable for. Avoid food, water, or child-safety uses if its material, cleanliness, or condition is uncertain.',
    locationSpecific: false,
  },
  donate: {
    applicable: true,
    guidance: 'If the item is clean, safe, and usable, ask a recipient or local organisation whether it accepts this type of item. Remove personal data from electronics.',
    locationSpecific: true,
  },
  recycle: {
    applicable: true,
    guidance: 'Identify the item’s materials and check whether your local authority or an authorised service accepts them. Keep batteries and hazardous components separate.',
    locationSpecific: true,
  },
  dispose: {
    applicable: true,
    guidance: 'If the item cannot be safely maintained, repaired, reused, donated, or recycled, follow local disposal instructions. Do not burn or dump it.',
    locationSpecific: true,
  },
};

const exampleItems = [
  'Smartphone',
  'Laptop',
  'Battery',
  'Clothing',
  'Glass jar',
  'Cardboard box',
  'Food scraps',
  'Bicycle',
  'Cooking oil',
  'Paint can',
];

const itemAliases: Record<string, string> = {
  'mobile phone': 'smartphone',
  'smartphones': 'smartphone',
  'old phone': 'smartphone',
  phone: 'smartphone',
  tablet: 'laptop',
  laptops: 'laptop',
  computer: 'laptop',
  notebook: 'laptop',
  'mobile charger': 'charger',
  'phone charger': 'charger',
  'laptop charger': 'charger',
  'power adapter': 'charger',
  'used battery': 'battery',
  'lithium battery': 'battery',
  'battery pack': 'battery',
  'clothes': 'clothing',
  'coat': 'clothing',
  'coats': 'clothing',
  'old clothes': 'clothing',
  'shirt': 'clothing',
  't-shirt': 'clothing',
  'textiles': 'clothing',
  'old shoes': 'shoes',
  'shoe': 'shoes',
  footwear: 'shoes',
  'cardboard': 'paper',
  'papers': 'paper',
  'cardboard box': 'paper',
  'newspaper': 'paper',
  'office paper': 'paper',
  'book': 'paper',
  'books': 'paper',
  'glass bottle': 'glass jar',
  'glass jars': 'glass jar',
  'plastic bottle': 'plastic container',
  'plastic containers': 'plastic container',
  'e-waste': 'laptop',
  'electronic waste': 'laptop',
  'food waste': 'food',
  'food scraps': 'food',
  'banana peel': 'food',
  'banana peels': 'food',
  'vegetable waste': 'food',
  'vegetable scraps': 'food',
  'leftover food': 'food',
  'bike': 'bicycle',
  'bikes': 'bicycle',
  'old bicycle': 'bicycle',
  'sofa': 'furniture',
  'couch': 'furniture',
  'table': 'furniture',
  'desk': 'furniture',
  'metal can': 'metal can',
  'aluminium can': 'metal can',
  'aluminum can': 'metal can',
  'tin can': 'metal can',
  'children toy': 'toy',
  'soft toy': 'toy',
  'stuffed toy': 'toy',
  'old mattress': 'mattress',
  'washing machine': 'appliance',
  'refrigerator': 'appliance',
  'appliances': 'appliance',
  'fridge': 'appliance',
  'microwave': 'appliance',
  'television': 'appliance',
  'tv': 'appliance',
  'electrical appliance': 'appliance',
  'used cooking oil': 'cooking oil',
  'cooking oils': 'cooking oil',
  'paint': 'paint or chemical',
  'chemicals': 'paint or chemical',
  'paint can': 'paint or chemical',
  'household chemical': 'paint or chemical',
  'cleaning chemical': 'paint or chemical',
};

function normalizeItem(item: string): string {
  return item.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function getItemGuidance(item: string): { guidance: Partial<Record<CircularKey, OptionGuidance>>; matched: boolean } {
  const normalized = normalizeItem(item);
  const directMatch = itemGuidance[normalized];
  if (directMatch) return { guidance: directMatch, matched: true };

  const aliasMatch = itemAliases[normalized];
  if (aliasMatch) return { guidance: itemGuidance[aliasMatch], matched: true };

  const knownNames = [...Object.keys(itemGuidance), ...Object.keys(itemAliases)]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => new RegExp(`(?:^|\\s)${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`).test(normalized));
  if (knownNames) {
    const canonicalItem = itemAliases[knownNames] ?? knownNames;
    return { guidance: itemGuidance[canonicalItem], matched: true };
  }

  return { guidance: generalGuidance, matched: false };
}

function getLocalDateString(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

export default function CircularLiving() {
  const { currentWorkspace } = useWorkspace();
  const [itemType, setItemType] = useState('');
  const [searched, setSearched] = useState('');
  const [savingOption, setSavingOption] = useState<CircularKey | null>(null);
  const [savedOptions, setSavedOptions] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [searchError, setSearchError] = useState('');

  const resolvedGuidance = searched ? getItemGuidance(searched) : null;
  const guidance = resolvedGuidance?.guidance ?? null;
  const actionKey = (option: CircularKey) => `${searched.toLowerCase()}:${option}`;

  const handleSearch = () => {
    const item = itemType.trim().replace(/\s+/g, ' ');
    if (!item) {
      setSearched('');
      setSearchError('Enter an item name to see its options.');
      return;
    }
    setSearchError('');
    setSearched(item);
    setSaveError('');
  };

  const handleSaveAction = async (option: CircularKey, label: string, optionGuidance: string) => {
    if (!currentWorkspace.id) {
      setSaveError('Create or select a workspace before adding this to your Action Planner.');
      return;
    }

    setSavingOption(option);
    setSaveError('');
    try {
      const action = await createAction({
        workspace_id: currentWorkspace.id,
        recommendation_id: null,
        title: `${label} ${searched}`,
        category: 'waste-circular',
        status: 'planned',
        planned_date: getLocalDateString(),
        initial_estimate_currency: 'INR',
        notes: `Circular Living choice: ${label} for ${searched}. Guidance: ${optionGuidance} Local service availability and rules should be verified.`,
      });
      setSavedOptions((previous) => ({ ...previous, [actionKey(option)]: action.id }));
    } catch (error) {
      console.error('Unable to add Circular Living choice to the Action Planner', error);
      setSaveError(error instanceof Error ? error.message : 'Could not add this action to your planner.');
    } finally {
      setSavingOption(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Circular Living Finder</h1>
        <p className={styles.pageSubtitle}>
          Find the best option for your item — from maintaining and repairing to reusing, donating, recycling, or responsible disposal.
          Guided by the waste hierarchy: prevention first, disposal last.
        </p>
      </div>

      {/* Waste Hierarchy visual */}
      <div className={styles.hierarchyBar}>
        <div className={styles.hierarchyLabel}>Waste Hierarchy (most preferred → least preferred)</div>
        <div className={styles.hierarchyPills}>
          {circularOptions.map((opt) => (
            <span key={opt.key} className={`${styles.hierarchyPill} ${styles[`hPill_${opt.color}`]}`}>
              <opt.icon size={12} /> {opt.label}
            </span>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchCard}>
        <div className={styles.searchRow}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Item Type</label>
            <input
              type="text"
              placeholder="e.g. laptop, battery, clothes, food scraps..."
              value={itemType}
              onChange={(e) => {
                setItemType(e.target.value);
                if (searchError) setSearchError('');
              }}
              className={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button className={styles.searchBtn} onClick={handleSearch}>
            <Search size={16} /> Find Options
          </button>
        </div>

        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try an example:</span>
          {exampleItems.map((item) => (
            <button key={item} className={styles.examplePill} onClick={() => {
              setItemType(item);
              setSearched(item);
              setSearchError('');
              setSaveError('');
            }}>
              {item} <ArrowRight size={12} />
            </button>
          ))}
        </div>
        {searchError && <p className={styles.searchError} role="alert">{searchError}</p>}
      </div>

      {/* Options Grid (always visible) */}
      <div className={styles.optionsGrid}>
        {circularOptions.map((opt) => {
          const g = guidance?.[opt.key];
          const savedActionId = savedOptions[actionKey(opt.key)];
          return (
            <div key={opt.key} className={`${styles.optionCard} ${styles[`card_${opt.color}`]} ${g && !g.applicable ? styles.notApplicable : ''}`}>
              <div className={styles.optionHeader}>
                <div className={`${styles.optionIcon} ${styles[`icon_${opt.color}`]}`}>
                  <opt.icon size={22} />
                </div>
                <div>
                  <div className={styles.optionLabel}>{opt.label}</div>
                  {g && !g.applicable && <span className={styles.naTag}>Not recommended</span>}
                  {opt.priority === 1 || opt.priority === 2 ? <span className={styles.preferredTag}>Preferred</span> : null}
                </div>
              </div>
              <p className={styles.optionDesc}>
                {g ? g.guidance : opt.description}
              </p>
              {g?.locationSpecific && (
                <div className={styles.locationNote}>
                  <Info size={12} /> Check your urban local body or an authorised local service.
                </div>
              )}
              {searched && g?.applicable && (
                savedActionId ? (
                  <div className={styles.savedAction}>
                    <CheckCircle2 size={15} /> Added to Action Planner
                  </div>
                ) : (
                  <button
                    className={styles.searchBtn}
                    type="button"
                    disabled={savingOption !== null}
                    onClick={() => void handleSaveAction(opt.key, opt.label, g.guidance)}
                  >
                    {savingOption === opt.key ? 'Adding…' : 'Add to Action Planner'}
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {saveError && <div className={styles.noResults} role="alert">{saveError}</div>}
      {Object.keys(savedOptions).some((key) => key.startsWith(`${searched.toLowerCase()}:`)) && (
        <div className={styles.savedNotice} role="status">
          Your chosen action is now planned, not completed. Open the <Link to="/action-planner">Action Planner</Link> to update its progress. The <Link to="/impact">Impact Ledger</Link> shows it once marked in progress or completed.
        </div>
      )}

      {searched && resolvedGuidance && !resolvedGuidance.matched && (
        <div className={styles.noResults}>
          <Info size={20} />
          <p>Showing general, safety-first guidance for "<strong>{searched}</strong>". Check the item’s label and condition before acting; recommendations may vary by material and local rules.</p>
          <p className={styles.localNote}>For recycling facilities, collection services, and donation options, check with your urban local body, relevant State Pollution Control Board, or an authorised waste service.</p>
        </div>
      )}

      <div className={styles.disclaimer}>
        <Info size={14} />
        <span>Guidance is general and does not confirm that a local collection service exists. Recycling rules vary across India; verify with your urban local body, relevant State Pollution Control Board, or authorised service provider.</span>
      </div>
    </div>
  );
}
