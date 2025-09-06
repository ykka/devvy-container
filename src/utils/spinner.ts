import ora, { type Ora } from 'ora'

export class Spinner {
  private spinner: Ora

  constructor(text?: string) {
    this.spinner = ora({
      text: text || 'Loading...',
      spinner: 'dots',
    })
  }

  public start(text?: string): this {
    if (text) {
      this.spinner.text = text
    }
    this.spinner.start()
    return this
  }

  public stop(): this {
    this.spinner.stop()
    return this
  }

  public succeed(text?: string): this {
    this.spinner.succeed(text || this.spinner.text)
    return this
  }

  public fail(text?: string): this {
    this.spinner.fail(text || this.spinner.text)
    return this
  }

  public warn(text?: string): this {
    this.spinner.warn(text || this.spinner.text)
    return this
  }

  public info(text?: string): this {
    this.spinner.info(text || this.spinner.text)
    return this
  }

  public updateText(text: string): this {
    this.spinner.text = text
    return this
  }

  public clear(): this {
    this.spinner.clear()
    return this
  }

  public static async withSpinner<T>(text: string, action: () => Promise<T>): Promise<T> {
    const spinner = new Spinner(text)
    spinner.start()

    try {
      const result = await action()
      spinner.succeed()
      return result
    } catch (error) {
      spinner.fail()
      throw error
    }
  }

  public static createProgressSpinner(steps: string[]): {
    next: () => void
    complete: () => void
    fail: (error?: string) => void
  } {
    let currentStep = 0
    const spinner = new Spinner(steps[0])
    spinner.start()

    return {
      next: () => {
        if (currentStep < steps.length - 1) {
          spinner.succeed(steps[currentStep])
          currentStep++
          spinner.start(steps[currentStep])
        }
      },
      complete: () => {
        spinner.succeed(steps[currentStep] || 'Completed')
      },
      fail: (error?: string) => {
        spinner.fail(error || steps[currentStep] || 'Failed')
      },
    }
  }
}
