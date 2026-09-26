import { useState } from "react";
import { Question } from "./types";
import { IconCheck } from "./icons";
import type { ChatTexts } from "./texts";

/**
 * Rückfrage-Karte: Optionen untereinander, wahlweise Einzel- oder Mehrfachauswahl
 * (question.multi), dazu immer eine freie Antwortzeile. Nach der Antwort nur noch Beleg.
 */
export function QuestionCard({
  text,
  question,
  texts,
  onAnswer,
}: {
  text: string;
  question: Question;
  texts: ChatTexts;
  onAnswer: (text: string) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [frei, setFrei] = useState("");

  if (question.answer !== undefined) {
    return (
      <div className="qsl-question">
        <div className="qsl-question__text">{text}</div>
        <div className="qsl-question__answered">
          <IconCheck className="qsl-question__check" size={12} />
          {question.answer}
        </div>
      </div>
    );
  }

  const umschalten = (option: string) =>
    setGewaehlt((bisher) =>
      bisher.includes(option) ? bisher.filter((o) => o !== option) : [...bisher, option]);

  const freiSenden = () => {
    const wert = frei.trim();
    if (wert) onAnswer(wert);
  };

  return (
    <div className="qsl-question">
      <div className="qsl-question__text">{text}</div>
      <div className="qsl-question__options">
        {question.options.map((option) =>
          question.multi ? (
            <button
              aria-pressed={gewaehlt.includes(option)}
              className={
                gewaehlt.includes(option)
                  ? "qsl-question__option qsl-question__option--gewaehlt"
                  : "qsl-question__option"
              }
              key={option}
              onClick={() => umschalten(option)}
              type="button"
            >
              <span className="qsl-question__kasten">
                {gewaehlt.includes(option) && <IconCheck size={10} />}
              </span>
              {option}
            </button>
          ) : (
            <button className="qsl-question__option" key={option} onClick={() => onAnswer(option)} type="button">
              {option}
            </button>
          ),
        )}
      </div>
      {question.multi && (
        <button
          className="qsl-question__uebernehmen"
          disabled={gewaehlt.length === 0}
          onClick={() => onAnswer(gewaehlt.join("; "))}
          type="button"
        >
          {texts.questionSubmit}
        </button>
      )}
      <div className="qsl-question__frei">
        <input
          className="qsl-field qsl-question__frei-feld"
          onChange={(event) => setFrei(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) freiSenden();
          }}
          placeholder={texts.questionPlaceholder}
          value={frei}
        />
        <button
          className="qsl-question__frei-senden"
          disabled={frei.trim() === ""}
          onClick={freiSenden}
          type="button"
        >
          {texts.questionAnswer}
        </button>
      </div>
    </div>
  );
}
