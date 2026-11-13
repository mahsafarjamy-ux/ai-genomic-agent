import Link from "next/link";
import styles from "./pet-oncology/oncology.module.css";

export default function Home() {
  return (
    <main className={styles.canvas}>
      <header className={styles.bar}><strong>BioVerse</strong><Link href="/account">My account ↗</Link></header>
      <div className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>BioVerse genomics</p>
          <h1>What would you<br />like to explore?</h1>
        </div>
        <div className={styles.paths}>
          <Link className={styles.feature} href="/pet-oncology">
            <span>Veterinary oncology</span>
            <div><h2>Pet cancer vaccine research</h2><p>Request analysis of your dog’s tumor, or ask about sample collection and sequencing.</p><strong>Explore pet oncology ↗</strong></div>
          </Link>
          <div className={styles.side}>
            <Link href="/personal"><span>For individuals</span><h2>Personal DNA analysis</h2><p>Explore your raw DNA data online or with the offline desktop app.</p><strong>Explore Personal DNA ↗</strong></Link>
            <Link href="/science"><span>For scientists</span><h2>Research tools</h2><p>Build reproducible genomics workflows and explore research data.</p><strong>Open research tools ↗</strong></Link>
          </div>
        </div>
      </div>
    </main>
  );
}
