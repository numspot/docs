import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import { useLocation } from "@docusaurus/router";
import Translate, { translate } from "@docusaurus/Translate";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faThumbsUp,
  faThumbsDown,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import styles from "./styles.module.css";

type Vote = "yes" | "no";

// Sends the event to GA4 via gtag (injected by @docusaurus/plugin-google-gtag
// only in the production build). In dev, gtag is absent: no-op.
function sendFeedbackEvent(page: string, helpful: Vote, comment?: string): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
    .gtag;
  if (typeof gtag !== "function") return;
  gtag("event", "page_feedback", {
    page_path: page,
    helpful,
    ...(comment ? { comment } : {}),
  });
}

export default function PageFeedback(): React.ReactNode {
  const { pathname } = useLocation();

  const [submitted, setSubmitted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The vote is only kept in memory (React state): the "Thank you" state stays
  // displayed after the vote, but a page reload allows voting again.
  // We also reset on every page change (SPA navigation).
  useEffect(() => {
    setSubmitted(false);
    setModalOpen(false);
    setComment("");
  }, [pathname]);

  const handleYes = (): void => {
    sendFeedbackEvent(pathname, "yes");
    setSubmitted(true);
  };

  const handleNo = (): void => {
    // Record nothing until the user has confirmed their "No": they can still
    // cancel (mis-click) via the cross / Esc / click outside the modal.
    setModalOpen(true);
  };

  const submitComment = (): void => {
    const trimmed = comment.trim();
    sendFeedbackEvent(pathname, "no", trimmed || undefined);
    setModalOpen(false);
    setSubmitted(true);
  };

  // "Skip": the "No" vote is intentional, the user just chooses not to leave
  // a comment. Record the "no" vote (without comment) in GA4, then close the
  // modal and show the "Thank you" state.
  const skipComment = (): void => {
    sendFeedbackEvent(pathname, "no");
    setModalOpen(false);
    setSubmitted(true);
  };

  // Cross / Esc / click outside the modal: cancels the "No" click (mis-click)
  // and returns to the Yes / No choice, recording nothing.
  const cancelModal = (): void => {
    setModalOpen(false);
    setComment("");
  };

  // Focus the field on open + close via keyboard (Esc).
  useEffect(() => {
    if (!modalOpen) return;
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") cancelModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  return (
    <div className={styles.wrapper}>
      {submitted ? (
        <p className={styles.thanks} role="status">
          <Translate
            id="feedback.thanks"
            description="Message de remerciement après un vote de feedback"
          >
            Merci pour votre retour !
          </Translate>
        </p>
      ) : (
        <div className={styles.prompt}>
          <span className={styles.question}>
            <Translate
              id="feedback.question"
              description="Question posée en pied de page de doc"
            >
              Cette page vous a-t-elle été utile ?
            </Translate>
          </span>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.button}
              onClick={handleYes}
            >
              <FontAwesomeIcon icon={faThumbsUp} className={styles.icon} />
              <Translate
                id="feedback.yes"
                description="Bouton oui du feedback"
              >
                Oui
              </Translate>
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={handleNo}
            >
              <FontAwesomeIcon icon={faThumbsDown} className={styles.icon} />
              <Translate id="feedback.no" description="Bouton non du feedback">
                Non
              </Translate>
            </button>
          </div>
        </div>
      )}

      {modalOpen &&
        ExecutionEnvironment.canUseDOM &&
        createPortal(
          <div
            className={styles.overlay}
            onClick={cancelModal}
            role="presentation"
          >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.close}
              aria-label={translate({
                id: "feedback.modal.close",
                message: "Close",
                description: "Libellé accessible du bouton de fermeture",
              })}
              onClick={cancelModal}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <h3 id="feedback-modal-title" className={styles.modalTitle}>
              <Translate
                id="feedback.modal.title"
                description="Titre de la modal de commentaire négatif"
              >
                Comment pourrions-nous améliorer cette page ?
              </Translate>
            </h3>
            <p className={styles.modalSubtitle}>
              <Translate
                id="feedback.modal.subtitle"
                description="Sous-titre de la modal indiquant que le commentaire est optionnel"
              >
                Votre commentaire est optionnel, mais précieux pour nous.
              </Translate>
            </p>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder={translate({
                id: "feedback.modal.placeholder",
                message: "Tell us what we could improve… (optional)",
                description: "Placeholder du champ de commentaire",
              })}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={skipComment}
              >
                <Translate
                  id="feedback.modal.back"
                  description="Bouton pour envoyer le vote « Non » sans laisser de commentaire"
                >
                  Passer
                </Translate>
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={submitComment}
              >
                <Translate
                  id="feedback.modal.submit"
                  description="Bouton d'envoi du commentaire"
                >
                  Envoyer
                </Translate>
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
