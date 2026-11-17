import { Header } from "@/components/Header";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <footer className="gm-footer">
        <div className="gm-container gm-row gm-between">
          <span>GLAMOTION demo · fictional brands · illustrative try-on</span>
          <span>Camera and photos are processed on your device and never uploaded.</span>
        </div>
      </footer>
    </>
  );
}
