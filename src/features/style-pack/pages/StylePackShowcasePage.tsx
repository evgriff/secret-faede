import { Link } from 'react-router-dom';

import {
  logoDirections,
  PrimaryLogoLockup,
} from '../../../assets/brand/BrandMarks';
import {
  CalendarIcon,
  CloudIcon,
  FoldedMapIcon,
  gardenIconRegistry,
  GardenGlyphIcon,
  ReminderBellIcon,
  SproutIcon,
  SunIcon,
  WateringCanIcon,
} from '../../../assets/icons/GardenIcons';
import { PlantPin } from '../../../assets/icons/PlantPins';
import {
  BotanicalDivider,
  FoldedMapIllustration,
  illustrationRegistry,
  RouteLineIllustration,
  SproutSceneIllustration,
} from '../../../assets/illustrations/GardenIllustrations';
import { routePaths } from '../../../shared/lib/routes';
import styles from './StylePackShowcasePage.module.css';

const neutralSwatches = [
  ['--color-paper', '#F7F4EE'],
  ['--color-paper-soft', '#EFEAE2'],
  ['--color-paper-muted', '#E6E0D7'],
  ['--color-ink', '#1F1B18'],
  ['--color-ink-soft', '#4E473F'],
  ['--color-line-soft', '#6D655D'],
] as const;

const accentSwatches = [
  ['--color-plant-green', '#73A36B'],
  ['--color-plant-tomato', '#D96C5B'],
  ['--color-plant-marigold', '#E4B64D'],
  ['--color-plant-sky', '#79AFC9'],
  ['--color-plant-lavender', '#A78BC6'],
  ['--color-plant-berry', '#C66A88'],
] as const;

const toneVariants = [
  'neutral',
  'green',
  'tomato',
  'marigold',
  'sky',
  'lavender',
  'berry',
] as const;

const stateVariants = [
  'default',
  'selected',
  'dragging',
  'ghost',
  'completed',
  'needs-attention',
] as const;

export function StylePackShowcasePage() {
  return (
    <section className={`pageShell ${styles.page}`} data-route-shell="true">
      <div className={`pageCard ${styles.hero}`}>
        <div className={styles.heroLayout}>
          <div className="stack">
            <p className="pageLead">Style pack / dev route</p>
            <h1 className="pageTitle">
              Paper, ink, quiet motion, and color reserved for living things.
            </h1>
            <p className={styles.subtle}>
              This style pack turns the app into a restrained field guide with
              hand-drawn SVG assets, a neutral paper base, and small semantic
              pops of garden color. It is meant to stay sparse, editable, and
              useful.
            </p>
            <div className="stack">
              <PrimaryLogoLockup className={styles.heroMark} />
              <div className={styles.dividerWrap}>
                <BotanicalDivider animated className="botanicalDivider" />
              </div>
            </div>
          </div>
          <div className="stack">
            <FoldedMapIllustration
              accentColor="var(--color-plant-marigold)"
              animated
              title="Folded plot map illustration"
            />
            <Link className="inkButton" to={routePaths.signIn}>
              Return to the app
            </Link>
          </div>
        </div>
      </div>

      <div className={`pageCard ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Palette</h2>
        <p className="pageLead">
          Large surfaces stay neutral. Accent colors belong in pins, badges,
          reminders, plant states, and tiny illustration details.
        </p>
        <div className={styles.swatchGrid}>
          {[...neutralSwatches, ...accentSwatches].map(([token, value]) => (
            <article className={styles.swatch} key={token}>
              <div
                className={styles.swatchChip}
                style={{ background: `var(${token})` }}
              />
              <div className={styles.swatchMeta}>
                <span className={styles.tokenName}>{token}</span>
                <span className="tokenCaption">{value}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className={`pageCard ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Logo directions</h2>
        <p className="pageLead">
          Direction A is the primary recommendation because it works best at
          app-mark size while still carrying the seed-and-pin story.
        </p>
        <div className={styles.logoGrid}>
          {logoDirections.map(
            ({ component: LogoComponent, id, label, recommendation }) => (
              <article className={styles.logoCard} key={id}>
                {id === 'seed-pin' ? (
                  <span className={styles.recommendation}>
                    {recommendation}
                  </span>
                ) : null}
                <LogoComponent
                  accentColor="var(--color-plant-green)"
                  animated
                  size={96}
                />
                <h3 className={styles.sectionTitle}>{label}</h3>
                <p className="pageLead">{recommendation}</p>
              </article>
            ),
          )}
        </div>
      </div>

      <div className={`pageCard ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Custom icon family</h2>
        <div className={styles.iconGrid}>
          {gardenIconRegistry.map(
            ({ component: IconComponent, label, name }) => (
              <article className={styles.iconCard} key={name}>
                <IconComponent
                  accentColor="var(--color-plant-sky)"
                  animated
                  size={34}
                  title={label}
                />
                <span className={styles.iconName}>{label}</span>
                <span className="tokenCaption">{name}</span>
              </article>
            ),
          )}
        </div>
      </div>

      <div className={`pageCard ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Plant pin system</h2>
        <p className="pageLead">
          One silhouette, small state changes, selective accent fill, and a
          rough halo for focus or placement confirmation.
        </p>
        <div className={styles.pinGrid}>
          {toneVariants.map((tone) => (
            <article className={styles.pinCard} key={tone}>
              <PlantPin animated size={58} state="default" tone={tone} />
              <span className={styles.pinName}>{tone}</span>
            </article>
          ))}
        </div>
        <div className={styles.pinGrid}>
          {stateVariants.map((state) => (
            <article className={styles.pinCard} key={state}>
              <PlantPin animated size={58} state={state} tone="green" />
              <span className={styles.pinName}>{state}</span>
            </article>
          ))}
        </div>
      </div>

      <div className={`pageCard ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Illustration set</h2>
        <div className={styles.illustrationGrid}>
          {illustrationRegistry.map(
            ({ component: IllustrationComponent, id, label }) => (
              <article className={styles.illustrationCard} key={id}>
                <IllustrationComponent animated title={label} />
                <h3 className={styles.illustrationTitle}>{label}</h3>
              </article>
            ),
          )}
        </div>
      </div>

      <div className={`pageCard ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Motion vocabulary</h2>
        <div className={styles.motionGrid}>
          <article className={styles.motionCard}>
            <span className={styles.motionLabel}>Draw</span>
            <div className={styles.motionExampleRow}>
              <RouteLineIllustration
                accentColor="var(--color-plant-sky)"
                animated
                size="9rem"
              />
            </div>
            <span className="tokenCaption">350–600 ms reveal for line art</span>
          </article>
          <article className={styles.motionCard}>
            <span className={styles.motionLabel}>Bloom</span>
            <div className={styles.motionExampleRow}>
              <SproutIcon
                accentColor="var(--color-plant-green)"
                animated
                size={34}
              />
              <PlantPin animated size={56} state="selected" tone="marigold" />
            </div>
            <span className="tokenCaption">
              used for state entry, not idle looping
            </span>
          </article>
          <article className={styles.motionCard}>
            <span className={styles.motionLabel}>Nudge / settle</span>
            <div className={styles.motionExampleRow}>
              <ReminderBellIcon animated size={34} />
              <WateringCanIcon animated size={34} />
            </div>
            <span className="tokenCaption">one short gesture, then stop</span>
          </article>
          <article className={styles.motionCard}>
            <span className={styles.motionLabel}>Reduced motion</span>
            <div className={styles.motionExampleRow}>
              <span className="reducedMotionExample">
                <PlantPin
                  animated={false}
                  size={56}
                  state="selected"
                  tone="sky"
                />
              </span>
              <FoldedMapIcon animated={false} size={34} />
            </div>
            <span className="tokenCaption">
              opacity and static state carry the meaning
            </span>
          </article>
        </div>
      </div>

      <div className={`pageCard ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Component usage examples</h2>
        <div className={styles.componentGrid}>
          <article className={styles.mockCard}>
            <span className={styles.motionLabel}>Bottom navigation</span>
            <div className={styles.mockNav}>
              <div
                className={`${styles.mockNavItem} ${styles.mockNavItemActive}`}
              >
                <GardenGlyphIcon size={26} />
                <span>Garden</span>
              </div>
              <div className={styles.mockNavItem}>
                <CalendarIcon size={26} />
                <span>Plan</span>
              </div>
              <div className={styles.mockNavItem}>
                <SunIcon size={26} />
                <span>Weather</span>
              </div>
              <div className={styles.mockNavItem}>
                <ReminderBellIcon size={26} />
                <span>Tasks</span>
              </div>
            </div>
          </article>

          <article className={styles.mockCard}>
            <span className={styles.motionLabel}>Garden card</span>
            <div className={styles.mockGardenCard}>
              <div className={styles.mockGardenHeader}>
                <div className="stack">
                  <GardenGlyphIcon
                    accentColor="var(--color-plant-green)"
                    size={28}
                  />
                  <strong>North Lot</strong>
                </div>
                <span className={styles.miniTag}>owner</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.miniTag}>18×32 ft</span>
                <span className={styles.miniTag}>6 plots</span>
              </div>
              <BotanicalDivider className="botanicalDivider" size="100%" />
            </div>
          </article>

          <article className={styles.mockCard}>
            <span className={styles.motionLabel}>Plot / map area</span>
            <div className={styles.mapMock}>
              <div className={`${styles.bed} ${styles.bedOne}`} />
              <div className={`${styles.bed} ${styles.bedTwo}`} />
              <div className={`${styles.bed} ${styles.bedThree}`} />
              <div className={`${styles.pin} ${styles.pinA}`}>
                <PlantPin size={44} tone="green" />
              </div>
              <div className={`${styles.pin} ${styles.pinB}`}>
                <PlantPin size={44} state="selected" tone="tomato" />
              </div>
              <div className={`${styles.pin} ${styles.pinC}`}>
                <PlantPin size={44} state="ghost" tone="sky" />
              </div>
            </div>
          </article>

          <article className={styles.mockCard}>
            <span className={styles.motionLabel}>Task / reminder card</span>
            <div className={styles.taskCard}>
              <div className={styles.taskRow}>
                <span className={styles.taskAccent}>
                  <ReminderBellIcon
                    accentColor="var(--color-plant-marigold)"
                    size={30}
                  />
                </span>
                <div className="stack">
                  <strong>Check germination window</strong>
                  <span className="pageLead">
                    Marigold carries timing attention without turning the whole
                    card into an alert panel.
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article className={styles.mockCard}>
            <span className={styles.motionLabel}>Empty state</span>
            <div className={styles.emptyState}>
              <SproutSceneIllustration
                accentColor="var(--color-plant-green)"
                animated
                size="100%"
              />
              <div className="stack">
                <strong>No plantings yet</strong>
                <span className="pageLead">
                  Empty states stay airy and useful, never mascot-heavy.
                </span>
              </div>
            </div>
          </article>

          <article className={styles.mockCard}>
            <span className={styles.motionLabel}>Weather / care cues</span>
            <div className={styles.motionExampleRow}>
              <CloudIcon
                accentColor="var(--color-plant-sky)"
                animated
                size={34}
              />
              <SunIcon
                accentColor="var(--color-plant-marigold)"
                animated
                size={34}
              />
              <WateringCanIcon accentColor="var(--color-plant-sky)" size={34} />
            </div>
            <span className="pageLead">
              Accent colors stay attached to meaning: water, warmth, and active
              garden states.
            </span>
          </article>
        </div>
      </div>
    </section>
  );
}
