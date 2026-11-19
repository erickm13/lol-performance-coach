import type { Metadata } from "next";
import ComparisonDashboard from "./ComparisonDashboard";
import "./comparison.css";

export const metadata: Metadata = {
  title: "Comparación de modelos | Diff",
  description: "Comparación reproducible de respuestas JSON y CSV para Diff.",
};

export default function ModelComparisonPage() {
  return <ComparisonDashboard />;
}
