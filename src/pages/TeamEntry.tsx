import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { sendTeamApplicationToTelegram, type TeamApplicationData } from '../utils/telegram';
import './TeamEntry.css';

type TeamFormState = {
  name: string;
  telegram: string;
  instagram: string;
  occupation: string;
  occupationOther: string;
  incomeSatisfaction: string;
  incomeReason: string;
  desiredIncome: string;
  dailyWorkReadiness: string;
  experience: string;
  priority: string;
};

const STORAGE_KEY = 'team_entry_form';
const LAST_SUBMIT_KEY = 'team_entry_last_submit_at';
const RATE_LIMIT_MS = 15000;

const initialState: TeamFormState = {
  name: '',
  telegram: '',
  instagram: '',
  occupation: '',
  occupationOther: '',
  incomeSatisfaction: '',
  incomeReason: '',
  desiredIncome: '',
  dailyWorkReadiness: '',
  experience: '',
  priority: ''
};

function validateTelegram(value: string): boolean {
  return /^[a-zA-Z0-9_]{5,32}$/.test(value);
}

function validateInstagram(value: string): boolean {
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(value)) return false;
  if (value.startsWith('.') || value.endsWith('.')) return false;
  if (value.includes('..')) return false;
  return true;
}

function normalizeUsername(value: string): string {
  return value.replace(/^@+/, '').trim();
}

export const TeamEntry: React.FC = () => {
  const [form, setForm] = useState<TeamFormState>(initialState);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { form?: TeamFormState; step?: number };
      if (parsed.form) {
        setForm({ ...initialState, ...parsed.form });
      }
      if (typeof parsed.step === 'number' && parsed.step >= 0 && parsed.step <= 9) {
        setStep(parsed.step);
      }
    } catch {
      // ignore malformed localStorage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step }));
    } catch {
      // ignore storage failures
    }
  }, [form, step]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setErrors((prev) => {
        const next = { ...prev };
        if (form.telegram) {
          if (!validateTelegram(form.telegram)) next.telegram = 'Telegram: 5-32 символа, только буквы, цифры и _';
          else delete next.telegram;
        }
        if (form.instagram) {
          if (!validateInstagram(form.instagram)) next.instagram = 'Instagram: 1-30 символов, буквы/цифры/._';
          else delete next.instagram;
        }
        return next;
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [form.telegram, form.instagram]);

  const progress = useMemo(() => Math.round(((step + 1) / 10) * 100), [step]);

  const setField = (key: keyof TeamFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateStep = (stepIndex: number): boolean => {
    const nextErrors: Record<string, string> = {};

    if (stepIndex === 0 && !form.name.trim()) nextErrors.name = 'Обязательное поле';
    if (stepIndex === 1) {
      if (!form.telegram.trim()) nextErrors.telegram = 'Обязательное поле';
      else if (!validateTelegram(form.telegram)) nextErrors.telegram = 'Telegram: 5-32 символа, только буквы, цифры и _';
    }
    if (stepIndex === 2) {
      if (!form.instagram.trim()) nextErrors.instagram = 'Обязательное поле';
      else if (!validateInstagram(form.instagram)) nextErrors.instagram = 'Instagram: 1-30 символов, буквы/цифры/._';
    }
    if (stepIndex === 3) {
      if (!form.occupation) nextErrors.occupation = 'Обязательное поле';
      if (form.occupation === 'other' && !form.occupationOther.trim()) nextErrors.occupationOther = 'Уточните ваш вариант';
    }
    if (stepIndex === 4 && !form.incomeSatisfaction) nextErrors.incomeSatisfaction = 'Обязательное поле';
    if (stepIndex === 5 && !form.incomeReason.trim()) nextErrors.incomeReason = 'Обязательное поле';
    if (stepIndex === 6 && !form.desiredIncome.trim()) nextErrors.desiredIncome = 'Обязательное поле';
    if (stepIndex === 7 && !form.dailyWorkReadiness) nextErrors.dailyWorkReadiness = 'Обязательное поле';
    if (stepIndex === 8 && !form.experience.trim()) nextErrors.experience = 'Обязательное поле';
    if (stepIndex === 9 && !form.priority) nextErrors.priority = 'Обязательное поле';

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, 9));
  };

  const goBack = () => setStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    for (let i = 0; i < 10; i += 1) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }

    if (submitLockRef.current || isSubmitting) return;

    const lastSubmit = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
    const now = Date.now();
    if (now - lastSubmit < RATE_LIMIT_MS) {
      setErrors((prev) => ({
        ...prev,
        submit: 'Пожалуйста, подождите несколько секунд перед повторной отправкой.'
      }));
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.submit;
      return next;
    });

    const payload: TeamApplicationData = {
      name: form.name.trim(),
      telegram: form.telegram.trim(),
      instagram: form.instagram.trim(),
      occupation: form.occupation,
      occupationOther: form.occupationOther.trim(),
      incomeSatisfaction: form.incomeSatisfaction,
      incomeReason: form.incomeReason.trim(),
      desiredIncome: form.desiredIncome.trim(),
      dailyWorkReadiness: form.dailyWorkReadiness,
      experience: form.experience.trim(),
      priority: form.priority
    };

    try {
      const ok = await sendTeamApplicationToTelegram(payload);
      if (!ok) {
        setErrors((prev) => ({
          ...prev,
          submit: 'Не удалось отправить форму. Проверьте данные и попробуйте снова.'
        }));
        return;
      }

      localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
      localStorage.removeItem(STORAGE_KEY);
      setIsSuccess(true);
    } catch (error) {
      console.error('Team form submit error:', error);
      setErrors((prev) => ({
        ...prev,
        submit: 'Произошла ошибка при отправке. Попробуйте позже.'
      }));
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const stepTitle = [
    'Ваше имя',
    'Telegram для связи',
    'Instagram',
    'Чем вы занимаетесь сейчас?',
    'Устраивает ли вас текущий доход?',
    'Почему рассматриваете новый доход?',
    'Желаемый доход через 12 месяцев',
    'Готовы ли работать 1-2 часа в день системно?',
    'Есть ли опыт в продажах / сетевом / бизнесе?',
    'Что для вас важнее?'
  ][step];

  return (
    <div className="team-page">
      <header className="team-header">
        <Link to="/" className="logo-link">
          <img src="/logo.svg" alt="Logo" className="header-logo" />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="team-content">
        <section className="team-intro">
          <h1>Форма входа в команду</h1>
          <p>
            Когда я начинал в бизнесе, у меня не было ни команды из сотен людей, ни оборота в миллионы долларов.
            Эта анкета — не формальность.
            Это ваш первый шаг в систему, где результат — не случайность, а закономерность.
          </p>
          <h2>Продумайте каждый ответ.</h2>
        </section>

        {isSuccess ? (
          <section className="team-success">
            <h3>Спасибо за ответы.</h3>
            <p>
              После изучения анкеты мы свяжемся с вами, чтобы обсудить формат сотрудничества и договориться о личной
              встрече.
            </p>
            <Link to="/" className="team-back-home">На главную</Link>
          </section>
        ) : (
          <section className="team-form-card">
            <div className="team-progress-wrap">
              <div className="team-progress-meta">
                <span>Шаг {step + 1} из 10</span>
                <span>{progress}%</span>
              </div>
              <div className="team-progress-bar">
                <div className="team-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <h3 className="team-step-title">{stepTitle}</h3>

            <div className="team-step-body">
              {step === 0 && (
                <div className="team-field">
                  <input
                    type="text"
                    className={`team-input ${errors.name ? 'error' : ''}`}
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Введите имя"
                  />
                  {errors.name && <p className="team-error">{errors.name}</p>}
                </div>
              )}

              {step === 1 && (
                <div className="team-field">
                  <input
                    type="text"
                    className={`team-input ${errors.telegram ? 'error' : ''}`}
                    value={form.telegram}
                    onChange={(e) => setField('telegram', normalizeUsername(e.target.value))}
                    placeholder="username без @"
                  />
                  <p className="team-hint">Вводите username без символа @</p>
                  {errors.telegram && <p className="team-error">{errors.telegram}</p>}
                </div>
              )}

              {step === 2 && (
                <div className="team-field">
                  <input
                    type="text"
                    className={`team-input ${errors.instagram ? 'error' : ''}`}
                    value={form.instagram}
                    onChange={(e) => setField('instagram', normalizeUsername(e.target.value))}
                    placeholder="username без @"
                  />
                  <p className="team-hint">Вводите username без символа @</p>
                  {errors.instagram && <p className="team-error">{errors.instagram}</p>}
                </div>
              )}

              {step === 3 && (
                <div className="team-field">
                  <div className="team-options">
                    {['Работа', 'Бизнес', 'Декрет', 'Фриланс', 'Свое дело'].map((option) => (
                      <label key={option} className="team-option">
                        <input
                          type="radio"
                          name="occupation"
                          checked={form.occupation === option}
                          onChange={() => {
                            setField('occupation', option);
                            setField('occupationOther', '');
                          }}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                    <label className="team-option">
                      <input
                        type="radio"
                        name="occupation"
                        checked={form.occupation === 'other'}
                        onChange={() => setField('occupation', 'other')}
                      />
                      <span>Другое</span>
                    </label>
                  </div>
                  {form.occupation === 'other' && (
                    <input
                      type="text"
                      className={`team-input ${errors.occupationOther ? 'error' : ''}`}
                      value={form.occupationOther}
                      onChange={(e) => setField('occupationOther', e.target.value)}
                      placeholder="Уточните ваш вариант"
                    />
                  )}
                  {(errors.occupation || errors.occupationOther) && (
                    <p className="team-error">{errors.occupation || errors.occupationOther}</p>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="team-field team-options">
                  {['Полностью устраивает', 'Хотелось бы больше', 'Категорически не устраивает'].map((option) => (
                    <label key={option} className="team-option">
                      <input
                        type="radio"
                        name="incomeSatisfaction"
                        checked={form.incomeSatisfaction === option}
                        onChange={() => setField('incomeSatisfaction', option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                  {errors.incomeSatisfaction && <p className="team-error">{errors.incomeSatisfaction}</p>}
                </div>
              )}

              {step === 5 && (
                <div className="team-field">
                  <textarea
                    className={`team-textarea ${errors.incomeReason ? 'error' : ''}`}
                    value={form.incomeReason}
                    onChange={(e) => setField('incomeReason', e.target.value)}
                    placeholder="Ваш ответ"
                    rows={5}
                  />
                  {errors.incomeReason && <p className="team-error">{errors.incomeReason}</p>}
                </div>
              )}

              {step === 6 && (
                <div className="team-field">
                  <input
                    type="text"
                    className={`team-input ${errors.desiredIncome ? 'error' : ''}`}
                    value={form.desiredIncome}
                    onChange={(e) => setField('desiredIncome', e.target.value)}
                    placeholder="Например: 300 000 ₽ / 5000 $"
                  />
                  {errors.desiredIncome && <p className="team-error">{errors.desiredIncome}</p>}
                </div>
              )}

              {step === 7 && (
                <div className="team-field team-options">
                  {['Да', 'Нет', 'Не уверен(а)'].map((option) => (
                    <label key={option} className="team-option">
                      <input
                        type="radio"
                        name="dailyWorkReadiness"
                        checked={form.dailyWorkReadiness === option}
                        onChange={() => setField('dailyWorkReadiness', option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                  {errors.dailyWorkReadiness && <p className="team-error">{errors.dailyWorkReadiness}</p>}
                </div>
              )}

              {step === 8 && (
                <div className="team-field">
                  <textarea
                    className={`team-textarea ${errors.experience ? 'error' : ''}`}
                    value={form.experience}
                    onChange={(e) => setField('experience', e.target.value)}
                    placeholder="Опишите опыт"
                    rows={5}
                  />
                  {errors.experience && <p className="team-error">{errors.experience}</p>}
                </div>
              )}

              {step === 9 && (
                <div className="team-field team-options">
                  {['Быстрые деньги', 'Долгосрочная система', 'Окружение и развитие'].map((option) => (
                    <label key={option} className="team-option">
                      <input
                        type="radio"
                        name="priority"
                        checked={form.priority === option}
                        onChange={() => setField('priority', option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                  {errors.priority && <p className="team-error">{errors.priority}</p>}
                </div>
              )}
            </div>

            {errors.submit && <p className="team-error submit-error">{errors.submit}</p>}

            <div className="team-actions">
              <button type="button" onClick={goBack} className="team-btn team-btn-secondary" disabled={step === 0 || isSubmitting}>
                Назад
              </button>
              {step < 9 ? (
                <button type="button" onClick={goNext} className="team-btn team-btn-primary">
                  Далее
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} className="team-btn team-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Отправка...' : 'Отправить'}
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
