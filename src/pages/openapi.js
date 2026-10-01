// This custom openapi is a workaround to get Scalar to work with Docusaurus without using the Docusaurus integration.
// The Docusaurus integration is not working, when loading Scalar for the first time it works but when coming back to the page we get a zod error and Scalar fails to load.
// Maintained by: Farid NADERI - Numspot

import { useEffect, useRef, useState } from "react";
import Layout from "@theme/Layout";
import useBaseUrl from "@docusaurus/useBaseUrl";

// If you need to update the OpenAPI reference, do it here.
// Live spec (prod) — auto-updates with the API, but its CORS only allows the
// docs.numspot.com origin.
const OPENAPI_URL_LIVE = "https://api.eu-west-2.numspot.com/openapi";
// Same-origin static mirror (committed via `make spec-update`) — used in dev /
// previews where the live spec is blocked by CORS.
const OPENAPI_URL_MIRROR = "/files/openapi.yaml";
// Self-hosted build of @scalar/api-reference (jsdelivr was a third-party
// dependency: arbitrary JS, IP leak, down CDN = broken page). The file name
// carries the version; upgrade = replace static/js/vendor/ with the new
// bundle (https://cdn.jsdelivr.net/npm/@scalar/api-reference@X.Y.Z) and
// update the file name here.
const SCALAR_SCRIPT = "/js/vendor/scalar-api-reference-1.26.2.js";

function OpenApi() {
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  // Resolve static assets through useBaseUrl: non-default locales (fr) are
  // built under /<locale>/ and their static files are only served there.
  const scalarScriptUrl = useBaseUrl(SCALAR_SCRIPT);
  const specMirrorUrl = useBaseUrl(OPENAPI_URL_MIRROR);

  useEffect(() => {
    // Get the current theme from localStorage or html data-theme
    const getCurrentTheme = () => {
      try {
        return (
          localStorage.getItem("theme") ||
          document.documentElement.getAttribute("data-theme") ||
          "light"
        );
      } catch (error) {
        return "light";
      }
    };

    // Function to sync Scalar colorMode with Docusaurus' theme
    const syncTheme = (newTheme) => {
      try {
        document.body.classList.remove("light-mode", "dark-mode");
        document.body.classList.add(
          newTheme === "light" ? "light-mode" : "dark-mode"
        );
        localStorage.setItem("theme", newTheme);
        localStorage.setItem("colorMode", newTheme);
      } catch (error) {
        console.error("Theme sync error:", error);
      }
    };

    let currentTheme = getCurrentTheme();
    syncTheme(currentTheme); // Ensure both sources are in sync at startup

    const initScalar = () => {
      if (!containerRef.current) return;

      // Clear container before re-initializing
      containerRef.current.innerHTML = "";

      // Create the API reference script tag
      const script = document.createElement("script");
      script.id = "api-reference";
      // The live spec's CORS only allows docs.numspot.com; everywhere else
      // (localhost, GitLab Pages previews) we serve the same-origin mirror.
      const openapiUrl =
        window.location.hostname === "docs.numspot.com"
          ? OPENAPI_URL_LIVE
          : specMirrorUrl;
      script.dataset.url = openapiUrl;
      script.dataset.configuration = JSON.stringify({
        theme: "none",
        hideDarkModeToggle: true,
        darkMode: getCurrentTheme() === "dark",
        hideModels: true,
        hideSearch: false,
      });

      // Append the script inside the container div
      containerRef.current.appendChild(script);

      // Load Scalar API script
      const scalarScript = document.createElement("script");
      scalarScript.src = scalarScriptUrl;
      scalarScript.async = true;
      scalarScript.onload = () => {
        setTimeout(() => {
          setIsLoading(false); // Hide loader when Scalar script is loaded
        }, 100);
      };
      scalarScript.onerror = () => {
        console.error("Failed to load Scalar script");
        setIsLoading(false); // Hide loader even if loading fails
      };
      containerRef.current.appendChild(scalarScript);

      if (
        !document.body.classList.contains("light-mode") &&
        !document.body.classList.contains("dark-mode")
      ) {
        document.body.classList.add("light-mode");
      }
    };

    // Initialize Scalar
    initScalar();

    // Add custom CSS variables
    const style = document.createElement("style");
    style.innerHTML = `
      :root {
        --scalar-custom-header-height: 60px;
      }
      .loader-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: calc(100vh - 50px);
      }
      .loader {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #002d9c;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      html[data-theme="dark"] .loader {
        border: 4px solid #3b4a6b;
        border-top: 4px solid rgb(51, 129, 255);
      }
    `;
    document.head.appendChild(style);

    // Observe theme changes and update Scalar dynamically
    const observer = new MutationObserver(() => {
      const newTheme = getCurrentTheme();
      if (newTheme !== currentTheme) {
        currentTheme = newTheme;
        syncTheme(newTheme);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      document.head.removeChild(style);
      observer.disconnect();
    };
  }, []);

  return (
    <Layout
      title="Référence de l'API Numspot — Global"
      description="Référence complète de l'API Numspot : endpoints, paramètres et exemples de requêtes pour Compute, Réseau, Stockage, Connectivité, IAM et services managés."
    >
      <h1 className="sr-only">
        Référence de l'API Numspot — Global
      </h1>
      {isLoading && (
        <div className="loader-container">
          <div className="loader"></div>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ display: isLoading ? "none" : "block" }}
      ></div>
    </Layout>
  );
}

export default OpenApi;
