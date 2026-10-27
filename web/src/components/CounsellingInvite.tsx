import Link from "next/link";

export default function CounsellingInvite() {
  return <section aria-labelledby="counselling-invite" style={{ margin: "28px auto", padding: "28px", maxWidth: 980, border: "1px solid #bfd9d4", borderRadius: 20, background: "#f0f8f6", color: "#173e3c", position: "relative", zIndex: 2 }}>
    <p style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>BioVerse · Genetic counselling</p>
    <h2 id="counselling-invite" style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>Your DNA results, with a human perspective.</h2>
    <p style={{ maxWidth: 690, lineHeight: 1.7, marginBottom: 18 }}>In addition to your DNA analysis with BioVerse, book a virtual genetic counselling session with one of our consultants to discuss your questions and next steps.</p>
    <Link href="/counselling" style={{ display: "inline-block", borderRadius: 10, background: "#195d55", padding: "12px 20px", color: "white", fontWeight: 600 }}>Explore genetic counselling →</Link>
  </section>;
}
