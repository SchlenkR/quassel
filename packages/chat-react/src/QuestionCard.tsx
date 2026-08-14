import { Question } from "./types";
import { IconCheck } from "./icons";

/** Rückfrage-Karte: Optionen als Knöpfe, nach der Antwort nur noch Beleg mit Haken. */
export function QuestionCard({
  text,
  question,
  onAnswer,
}: {
  text: string;
  question: Question;
  onAnswer: (text: string) => void;
}) {
  return (
    <div className="qsl-question">
      <div className="qsl-question__text">{text}</div>
      {question.answer === undefined ? (
        <div className="qsl-question__options">
          {question.options.map((option) => (
            <button className="qsl-question__option" key={option} onClick={() => onAnswer(option)} type="button">
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="qsl-question__answered">
          <IconCheck className="qsl-question__check" size={12} />
          {question.answer}
        </div>
      )}
    </div>
  );
}
